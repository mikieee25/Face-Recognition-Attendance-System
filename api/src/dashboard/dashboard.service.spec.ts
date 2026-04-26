import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DashboardService } from "./dashboard.service";
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceType,
} from "../database/entities/attendance.entity";
import { Personnel, PersonnelSection } from "../database/entities/personnel.entity";
import { Schedule, ScheduleType } from "../database/entities/schedule.entity";

const adminUser = { id: 1, role: "admin", stationId: null };

const makePersonnel = (overrides: Partial<Personnel> = {}): Personnel =>
  ({
    id: 10,
    firstName: "Maria",
    lastName: "Santos",
    rank: "FO1",
    section: PersonnelSection.ADMIN,
    stationId: 1,
    isActive: true,
    imagePath: null,
    coverImagePath: null,
    station: { id: 1, name: "Sorsogon Central" } as any,
    ...overrides,
  } as Personnel);

const makeRecord = (overrides: Partial<AttendanceRecord> = {}): AttendanceRecord =>
  ({
    id: 100,
    personnelId: 10,
    type: AttendanceType.TimeIn,
    status: AttendanceStatus.Confirmed,
    confidence: 0.9,
    imagePath: null,
    isManual: false,
    createdBy: 1,
    createdAt: new Date("2026-04-24T08:00:00Z"),
    modifiedBy: null,
    modifiedAt: null,
    personnel: makePersonnel(),
    ...overrides,
  } as AttendanceRecord);

const makePersonnelQb = (items: Personnel[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(items),
});

const makeAttendanceQb = (items: AttendanceRecord[]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(items),
});

describe("DashboardService", () => {
  let service: DashboardService;
  let attendanceRepo: { createQueryBuilder: jest.Mock };
  let personnelRepo: { createQueryBuilder: jest.Mock };
  let scheduleRepo: { find: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(AttendanceRecord),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Personnel),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Schedule),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    attendanceRepo = module.get(getRepositoryToken(AttendanceRecord));
    personnelRepo = module.get(getRepositoryToken(Personnel));
    scheduleRepo = module.get(getRepositoryToken(Schedule));
  });

  it("counts personnel as present when they already have both time-in and time-out today", async () => {
    const personnel = makePersonnel();
    personnelRepo.createQueryBuilder.mockReturnValue(makePersonnelQb([personnel]));
    attendanceRepo.createQueryBuilder.mockReturnValue(
      makeAttendanceQb([
        makeRecord({
          id: 101,
          type: AttendanceType.TimeOut,
          createdAt: new Date("2026-04-24T17:00:00Z"),
        }),
        makeRecord({
          id: 100,
          type: AttendanceType.TimeIn,
          createdAt: new Date("2026-04-24T08:00:00Z"),
        }),
      ]),
    );
    scheduleRepo.find.mockResolvedValue([
      {
        id: 1,
        personnelId: 10,
        date: "2026-04-24",
        type: ScheduleType.REGULAR,
      },
    ]);

    const result = await service.getStats(adminUser);

    expect(result).toEqual({ present: 1, late: 0, shifting: 0, onLeave: 0 });
  });

  it("returns present status in personnel list when time-out exists after time-in on the same day", async () => {
    const personnel = makePersonnel();
    personnelRepo.createQueryBuilder.mockReturnValue(makePersonnelQb([personnel]));
    attendanceRepo.createQueryBuilder.mockReturnValue(
      makeAttendanceQb([
        makeRecord({
          id: 101,
          type: AttendanceType.TimeOut,
          createdAt: new Date("2026-04-24T17:00:00Z"),
        }),
        makeRecord({
          id: 100,
          type: AttendanceType.TimeIn,
          createdAt: new Date("2026-04-24T08:00:00Z"),
        }),
      ]),
    );
    scheduleRepo.find.mockResolvedValue([
      {
        id: 1,
        personnelId: 10,
        date: "2026-04-24",
        type: ScheduleType.REGULAR,
      },
    ]);

    const result = await service.getPersonnelStatus(adminUser, "2026-04-24");

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("present");
  });

  it("does not count unscheduled personnel as late in dashboard stats", async () => {
    const personnel = makePersonnel();
    personnelRepo.createQueryBuilder.mockReturnValue(makePersonnelQb([personnel]));
    attendanceRepo.createQueryBuilder.mockReturnValue(makeAttendanceQb([]));
    scheduleRepo.find.mockResolvedValue([]);

    const result = await service.getStats(adminUser);

    expect(result).toEqual({ present: 0, late: 0, shifting: 0, onLeave: 0 });
  });

  it("returns off_duty status when personnel has no schedule for the selected day", async () => {
    const personnel = makePersonnel();
    personnelRepo.createQueryBuilder.mockReturnValue(makePersonnelQb([personnel]));
    attendanceRepo.createQueryBuilder.mockReturnValue(makeAttendanceQb([]));
    scheduleRepo.find.mockResolvedValue([]);

    const result = await service.getPersonnelStatus(adminUser, "2026-04-26");

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("off_duty");
  });
});
