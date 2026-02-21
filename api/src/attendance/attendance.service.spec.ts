import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
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
import { Personnel } from "../database/entities/personnel.entity";
import { FaceService } from "../face/face.service";
import { AttendanceService, AuthenticatedUser } from "./attendance.service";
import { CaptureAttendanceDto } from "./dto/capture-attendance.dto";
import { ManualAttendanceDto } from "./dto/manual-attendance.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";

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
    faceService = module.get(FaceService);
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

    it("creates confirmed AttendanceRecord when confidence >= 0.7", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.85,
      });
      attendanceRepo.findOne.mockResolvedValue(null); // no prior record → time_in
      const created = mockRecord({ type: AttendanceType.TimeIn });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      const result = await service.capture(dto, adminUser);

      expect(attendanceRepo.save).toHaveBeenCalled();
      expect((result as AttendanceRecord).status).toBe(
        AttendanceStatus.Confirmed,
      );
    });

    it("creates PendingApproval when 0.5 <= confidence < 0.7", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.6,
      });
      const pending = { id: 1, personnelId: 10, confidence: 0.6 };
      pendingRepo.create.mockReturnValue(pending);
      pendingRepo.save.mockResolvedValue(pending);

      const result = await service.capture(dto, adminUser);

      expect(pendingRepo.save).toHaveBeenCalled();
      expect((result as any).confidence).toBe(0.6);
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

    it("propagates ServiceUnavailableException from FaceService", async () => {
      faceService.recognize.mockRejectedValue(
        new ServiceUnavailableException("Face recognition service unavailable"),
      );

      await expect(service.capture(dto, adminUser)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it("determines time_out when last confirmed record is time_in", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      attendanceRepo.findOne.mockResolvedValue(
        mockRecord({ type: AttendanceType.TimeIn }),
      );
      const created = mockRecord({ type: AttendanceType.TimeOut });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      const result = await service.capture(dto, adminUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.type).toBe(AttendanceType.TimeOut);
    });

    it("determines time_in when last confirmed record is time_out", async () => {
      faceService.recognize.mockResolvedValue({
        personnelId: 10,
        confidence: 0.9,
      });
      attendanceRepo.findOne.mockResolvedValue(
        mockRecord({ type: AttendanceType.TimeOut }),
      );
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
      attendanceRepo.findOne.mockResolvedValue(null);
      const created = mockRecord({ type: AttendanceType.TimeIn });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      await service.capture(dto, adminUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.type).toBe(AttendanceType.TimeIn);
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

    it("creates record with is_manual=true and created_by", async () => {
      personnelRepo.findOne.mockResolvedValue(mockPersonnel());
      const created = mockRecord({ isManual: true, createdBy: stationUser.id });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      const result = await service.createManual(dto, stationUser);

      const createCall = attendanceRepo.create.mock.calls[0][0];
      expect(createCall.isManual).toBe(true);
      expect(createCall.createdBy).toBe(stationUser.id);
    });

    it("admin can create manual entry for any station's personnel", async () => {
      personnelRepo.findOne.mockResolvedValue(mockPersonnel({ stationId: 99 }));
      const created = mockRecord({ isManual: true, createdBy: adminUser.id });
      attendanceRepo.create.mockReturnValue(created);
      attendanceRepo.save.mockResolvedValue(created);

      await expect(service.createManual(dto, adminUser)).resolves.toBeDefined();
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
