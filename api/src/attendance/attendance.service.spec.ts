import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as fs from "fs";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { SelectQueryBuilder } from "typeorm";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
} from "../database/entities/attendance.entity";
import { PendingApproval } from "../database/entities/pending-attendance.entity";
import {
  Personnel,
  PersonnelSection,
} from "../database/entities/personnel.entity";
import { Schedule, ScheduleType } from "../database/entities/schedule.entity";
import { FaceService } from "../face/face.service";
import { AttendanceService, AuthenticatedUser } from "./attendance.service";
import { CaptureAttendanceDto } from "./dto/capture-attendance.dto";
import { ManualAttendanceDto } from "./dto/manual-attendance.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
  };
});

const VALID_JPEG_PREFIX = "data:image/jpeg;base64,";
const VALID_IMAGE = VALID_JPEG_PREFIX + "abc123";

const adminUser: AuthenticatedUser = { id: 1, role: "admin", stationId: null };
const stationUser: AuthenticatedUser = {
  id: 2,
  role: "station_user",
  stationId: 1,
};

const mockPersonnel = (overrides: Partial<Personnel> = {}): Personnel =>
  ({
    id: 10,
    firstName: "Juan",
    lastName: "dela Cruz",
    rank: "FO1",
    stationId: 1,
    section: PersonnelSection.ADMIN,
    isActive: true,
    ...overrides,
  } as Personnel);

const mockRecord = (
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord =>
  ({
    id: 100,
    personnelId: 10,
    type: AttendanceType.TimeIn,
    status: AttendanceStatus.Confirmed,
    confidence: 0.9,
    imagePath: null,
    isManual: false,
    createdBy: 1,
    createdAt: new Date("2024-01-15T08:00:00Z"),
    modifiedBy: null,
    modifiedAt: null,
    personnel: mockPersonnel(),
    ...overrides,
  } as AttendanceRecord);

describe("AttendanceService", () => {
  let service: AttendanceService;
  let attendanceRepo: any;
  let pendingRepo: any;
  let personnelRepo: any;
  let scheduleRepo: any;
  let faceService: jest.Mocked<FaceService>;

  const makeQb = (items: any[] = [], total = 0) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, total]),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: getRepositoryToken(AttendanceRecord),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PendingApproval),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Personnel),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: FaceService,
          useValue: {
            recognize: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    attendanceRepo = module.get(getRepositoryToken(AttendanceRecord));
    pendingRepo = module.get(getRepositoryToken(PendingApproval));
    personnelRepo = module.get(getRepositoryToken(Personnel));
    scheduleRepo = module.get(getRepositoryToken(Schedule));
    faceService = module.get(FaceService);
    attendanceRepo.find.mockResolvedValue([]);
    personnelRepo.findOne.mockResolvedValue(mockPersonnel());
    scheduleRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (!where?.date) {
        return {
          id: 1,
          personnelId: 10,
          date: new Date().toISOString().slice(0, 10),
          type: ScheduleType.REGULAR,
          shiftStartTime: "00:00:00",
          shiftEndTime: "23:59:00",
        };
      }

      return {
        id: 1,
        personnelId: 10,
        date: where.date,
        type: ScheduleType.REGULAR,
        shiftStartTime: "00:00:00",
        shiftEndTime: "23:59:00",
      };
    });
    jest.mocked(fs.mkdirSync).mockClear();
    jest.mocked(fs.writeFileSync).mockClear();
  });

  // ─── capture ───────────────────────────────────────────────────────────────

  describe("capture", () => {
    const dto: CaptureAttendanceDto = { image: VALID_IMAGE };

    it("throws BadRequestException for invalid MIME type", async () => {
      const badDto = { image: "data:image/gif;base64,abc" };
      await expect(service.capture(badDto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException for oversized image", async () => {
      const oversized = VALID_JPEG_PREFIX + "x".repeat(14_000_000);
      await expect(
        service.capture({ image: oversized }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("routes off-duty capture to pending approval", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      scheduleRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where?.date) {
          return null;
        }

        return {
          id: 2,
          personnelId: 10,
          date: "2026-04-01",
          type: ScheduleType.REGULAR,
          shiftStartTime: "08:00:00",
          shiftEndTime: "17:00:00",
        };
      });
      const pending = { id: 1, personnelId: 10, confidence: 0.9 };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      const result = await service.capture(dto, adminUser);

      expect(result).toBe(pending);
      expect(attendanceRepo.save).not.toHaveBeenCalled();
      expect(pendingRepo.save).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("creates confirmed AttendanceRecord when confidence >= 0.7", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.85,
      });
      const created = mockRecord({ type: AttendanceType.TimeIn });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      const result = await service.capture(dto, adminUser);

      expect(attendanceRepo.save).toHaveBeenCalled();
      expect((result as AttendanceRecord).status).toBe(
        AttendanceStatus.Confirmed,
      );
    });

    it("creates PendingApproval when 0.4 <= confidence < 0.6", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.5,
      });
      const pending = { id: 1, personnelId: 10, confidence: 0.5 };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      const result = await service.capture(dto, adminUser);

      expect(pendingRepo.save).toHaveBeenCalled();
      expect((result as any).confidence).toBe(0.5);
    });

    it("throws UnprocessableEntityException when confidence < 0.5", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.3,
      });

      await expect(service.capture(dto, adminUser)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("wraps FaceService errors as UnprocessableEntityException", async () => {
      faceService.recognize.mockRejectedValue(
        new ServiceUnavailableException("Face recognition service unavailable"),
      );

      await expect(service.capture(dto, adminUser)).rejects.toThrow(
        new UnprocessableEntityException(
          "Face recognition service unavailable",
        ),
      );
    });

    it("determines time_out when last confirmed record is time_in", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      attendanceRepo.find.mockResolvedValue([
        mockRecord({ type: AttendanceType.TimeIn }),
      ]);
      const created = mockRecord({ type: AttendanceType.TimeOut });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      await service.capture(dto, adminUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.type).toBe(AttendanceType.TimeOut);
    });

    it("determines time_in when last confirmed record is time_out", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      attendanceRepo.find.mockResolvedValue([]);
      const created = mockRecord({ type: AttendanceType.TimeIn });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      await service.capture(dto, adminUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.type).toBe(AttendanceType.TimeIn);
    });

    it("first capture is always time_in (no prior record)", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      const created = mockRecord({ type: AttendanceType.TimeIn });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      await service.capture(dto, adminUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.type).toBe(AttendanceType.TimeIn);
    });

    it("blocks duplicate Time In on the same day", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      attendanceRepo.find.mockResolvedValue([
        mockRecord({ type: AttendanceType.TimeIn }),
      ]);

      await expect(
        service.capture({ ...dto, type: AttendanceType.TimeIn }, adminUser),
      ).rejects.toThrow(
        new BadRequestException("Time In already recorded for today."),
      );
    });

    it("blocks Time Out if there is no Time In yet today", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      attendanceRepo.find.mockResolvedValue([]);

      await expect(
        service.capture({ ...dto, type: AttendanceType.TimeOut }, adminUser),
      ).rejects.toThrow(
        new BadRequestException(
          "Cannot record Time Out. You need to Time In first.",
        ),
      );
    });

    it("allows Time Out during an active 72-hour shifting window", async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 3, 4, 7, 45, 0));

      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      scheduleRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.date === "2026-04-04") {
          return null;
        }

        if (where.date === "2026-04-03") {
          return null;
        }

        if (where.date === "2026-04-02") {
          return null;
        }

        if (where.date === "2026-04-01") {
          return {
            id: 1,
            personnelId: 10,
            date: "2026-04-01",
            type: ScheduleType.SHIFTING,
            shiftStartTime: "08:00:00",
            shiftEndTime: "08:00:00",
          };
        }

        return null;
      });
      attendanceRepo.find.mockResolvedValue([
        mockRecord({
          type: AttendanceType.TimeIn,
          createdAt: new Date(2026, 3, 1, 8, 5, 0),
        }),
      ]);
      const created = mockRecord({
        type: AttendanceType.TimeOut,
        createdAt: new Date(2026, 3, 4, 7, 45, 0),
      });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      await service.capture(dto, adminUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.type).toBe(AttendanceType.TimeOut);
      expect(attendanceRepo.save).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("routes expired shifting captures to pending approval", async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 3, 4, 9, 0, 0));

      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      scheduleRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.date === "2026-04-04") {
          return null;
        }

        if (where.date === "2026-04-03") {
          return null;
        }

        if (where.date === "2026-04-02") {
          return null;
        }

        if (where.date === "2026-04-01") {
          return {
            id: 1,
            personnelId: 10,
            date: "2026-04-01",
            type: ScheduleType.SHIFTING,
            shiftStartTime: "08:00:00",
            shiftEndTime: "08:00:00",
          };
        }

        return null;
      });
      attendanceRepo.find.mockResolvedValue([
        mockRecord({
          type: AttendanceType.TimeIn,
          createdAt: new Date(2026, 3, 1, 8, 5, 0),
        }),
      ]);
      const pending = { id: 1, personnelId: 10, confidence: 0.9 };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      const result = await service.capture(dto, adminUser);

      expect(result).toBe(pending);
      expect(pendingRepo.save).toHaveBeenCalled();
      expect(attendanceRepo.save).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  // ─── createManual ──────────────────────────────────────────────────────────

  describe("createManual", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow

    const dto: ManualAttendanceDto = {
      personnelId: 10,
      type: AttendanceType.TimeIn,
      date: pastDate,
    };

    it("throws BadRequestException for future date", async () => {
      await expect(
        service.createManual({ ...dto, date: futureDate }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException if personnel not found", async () => {
      personnelRepo.findOne.mockResolvedValue(null);

      await expect(service.createManual(dto, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException if station_user tries to create for another station", async () => {
      personnelRepo.findOne.mockResolvedValue(mockPersonnel({ stationId: 99 }));

      await expect(service.createManual(dto, stationUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("creates a pending manual entry for admin review", async () => {
      personnelRepo.findOne.mockResolvedValue(mockPersonnel());
      const pending = {
        id: 1,
        personnelId: dto.personnelId,
        attendanceType: "TIME_IN",
        reviewStatus: "pending",
        createdAt: new Date(dto.date),
      };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      await service.createManual(dto, stationUser);

      const createCall = pendingRepo.create.mock.calls[0][0];
      expect(createCall.personnelId).toBe(dto.personnelId);
      expect(createCall.attendanceType).toBe("TIME_IN");
      expect(createCall.reviewStatus).toBe("pending");
    });

    it("stores the uploaded manual photo when provided", async () => {
      personnelRepo.findOne.mockResolvedValue(mockPersonnel());
      const pending = {
        id: 3,
        personnelId: dto.personnelId,
        attendanceType: "TIME_IN",
        reviewStatus: "pending",
      };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      await service.createManual({ ...dto, photo: VALID_IMAGE }, stationUser);

      const createCall = pendingRepo.create.mock.calls[0][0];
      expect(createCall.imagePath).toMatch(
        /^uploads\/manual-attendance\/manual_10_\d+\.jpg$/,
      );
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("admin can create manual entry for any station's personnel", async () => {
      personnelRepo.findOne.mockResolvedValue(mockPersonnel({ stationId: 99 }));
      const pending = {
        id: 2,
        personnelId: dto.personnelId,
        attendanceType: "TIME_IN",
        reviewStatus: "pending",
      };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      await expect(service.createManual(dto, adminUser)).resolves.toEqual(
        pending,
      );
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated results", async () => {
      const items = [mockRecord()];
      const qb = makeQb(items, 1);
      attendanceRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 10 }, adminUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("applies station filter for station_user", async () => {
      const qb = makeQb([], 0);
      attendanceRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({}, stationUser);

      expect(qb.andWhere).toHaveBeenCalledWith(
        "personnel.stationId = :stationId",
        { stationId: stationUser.stationId },
      );
    });

    it("applies stationId filter for admin when provided", async () => {
      const qb = makeQb([], 0);
      attendanceRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ stationId: 5 }, adminUser);

      expect(qb.andWhere).toHaveBeenCalledWith(
        "personnel.stationId = :stationId",
        { stationId: 5 },
      );
    });

    it("applies type filter when provided", async () => {
      const qb = makeQb([], 0);
      attendanceRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ type: AttendanceType.TimeIn }, adminUser);

      expect(qb.andWhere).toHaveBeenCalledWith("ar.type = :type", {
        type: AttendanceType.TimeIn,
      });
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("throws NotFoundException if record not found", async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, {}, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException if station_user edits another station's record", async () => {
      attendanceRepo.findOne.mockResolvedValue(
        mockRecord({ personnel: mockPersonnel({ stationId: 99 }) }),
      );

      await expect(service.update(100, {}, stationUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("sets modified_at and modified_by on update", async () => {
      const record = mockRecord();
      attendanceRepo.findOne.mockResolvedValue(record);
      attendanceRepo.save.mockImplementation(async (r: any) => r);

      const before = new Date();
      await service.update(100, { type: AttendanceType.TimeOut }, adminUser);

      expect(record.modifiedBy).toBe(adminUser.id);
      expect(record.modifiedAt).toBeInstanceOf(Date);
      expect(record.modifiedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it("updates type field", async () => {
      const record = mockRecord({ type: AttendanceType.TimeIn });
      attendanceRepo.findOne.mockResolvedValue(record);
      attendanceRepo.save.mockImplementation(async (r: any) => r);

      await service.update(100, { type: AttendanceType.TimeOut }, adminUser);

      expect(record.type).toBe(AttendanceType.TimeOut);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("throws NotFoundException if record not found", async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it("removes the record", async () => {
      const record = mockRecord();
      attendanceRepo.findOne.mockResolvedValue(record);
      attendanceRepo.remove.mockResolvedValue(record);

      await service.remove(100);

      expect(attendanceRepo.remove).toHaveBeenCalledWith(record);
    });
  });
});
