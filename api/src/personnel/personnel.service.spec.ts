import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PersonnelService } from "./personnel.service";
import { Personnel } from "../database/entities/personnel.entity";
import { FaceData, FaceEmbedding } from "../database/entities/face-data.entity";
import { FaceService } from "../face/face.service";

const mockPersonnelRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
});

const mockFaceDataRepo = () => ({
  count: jest.fn(),
});

const mockFaceEmbeddingRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockFaceService = () => ({
  registerFace: jest.fn(),
});

const adminUser = { id: 1, role: "admin", stationId: null };
const stationUser = { id: 2, role: "station_user", stationId: 1 };

const makePersonnel = (overrides: Partial<Personnel> = {}): Personnel =>
  ({
    id: 10,
    firstName: "Juan",
    lastName: "Dela Cruz",
    rank: "FO1",
    stationId: 2,
    dateCreated: new Date(),
    isActive: true,
    imagePath: null,
    shiftStartTime: null,
    shiftEndTime: null,
    isShifting: false,
    shiftStartDate: null,
    shiftDurationDays: 15,
    station: null as any,
    ...overrides,
  } as Personnel);

describe("PersonnelService", () => {
  let service: PersonnelService;
  let personnelRepo: ReturnType<typeof mockPersonnelRepo>;
  let faceDataRepo: ReturnType<typeof mockFaceDataRepo>;
  let faceEmbeddingRepo: ReturnType<typeof mockFaceEmbeddingRepo>;
  let faceService: ReturnType<typeof mockFaceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonnelService,
        {
          provide: getRepositoryToken(Personnel),
          useFactory: mockPersonnelRepo,
        },
        {
          provide: getRepositoryToken(FaceData),
          useFactory: mockFaceDataRepo,
        },
        {
          provide: getRepositoryToken(FaceEmbedding),
          useFactory: mockFaceEmbeddingRepo,
        },
        {
          provide: FaceService,
          useFactory: mockFaceService,
        },
      ],
    }).compile();

    service = module.get<PersonnelService>(PersonnelService);
    personnelRepo = module.get(getRepositoryToken(Personnel));
    faceDataRepo = module.get(getRepositoryToken(FaceData));
    faceEmbeddingRepo = module.get(getRepositoryToken(FaceEmbedding));
    faceService = module.get(FaceService);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("admin gets all personnel without filter", async () => {
      const list = [
        makePersonnel({ stationId: 1 }),
        makePersonnel({ stationId: 2 }),
      ];
      personnelRepo.find.mockResolvedValue(list);

      const result = await service.findAll(adminUser);

      expect(personnelRepo.find).toHaveBeenCalledWith({ order: { id: "ASC" } });
      expect(result).toHaveLength(2);
    });

    it("station_user gets only their station personnel", async () => {
      const list = [makePersonnel({ stationId: stationUser.stationId })];
      personnelRepo.find.mockResolvedValue(list);

      const result = await service.findAll(stationUser);

      expect(personnelRepo.find).toHaveBeenCalledWith({
        where: { stationId: stationUser.stationId },
        order: { id: "ASC" },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("throws NotFoundException when personnel does not exist", async () => {
      personnelRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("admin can access any personnel", async () => {
      const p = makePersonnel({ stationId: 99 });
      personnelRepo.findOne.mockResolvedValue(p);
      const result = await service.findOne(10, adminUser);
      expect(result).toBe(p);
    });

    it("station_user cannot access personnel from another station", async () => {
      const p = makePersonnel({ stationId: 99 }); // different station
      personnelRepo.findOne.mockResolvedValue(p);
      await expect(service.findOne(10, stationUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("station_user can access their own station personnel", async () => {
      const p = makePersonnel({ stationId: stationUser.stationId });
      personnelRepo.findOne.mockResolvedValue(p);
      const result = await service.findOne(10, stationUser);
      expect(result).toBe(p);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    const dto = {
      first_name: "Maria",
      last_name: "Santos",
      rank: "FO2",
      station_id: 5,
    };

    it("admin uses station_id from DTO", async () => {
      const created = makePersonnel({ stationId: 5 });
      personnelRepo.create.mockReturnValue(created);
      personnelRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, adminUser);

      expect(personnelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stationId: 5 }),
      );
      expect(result).toBe(created);
    });

    it("station_user auto-assigns their own id as station_id", async () => {
      const created = makePersonnel({ stationId: stationUser.id });
      personnelRepo.create.mockReturnValue(created);
      personnelRepo.save.mockResolvedValue(created);

      await service.create(dto, stationUser);

      expect(personnelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stationId: stationUser.stationId }),
      );
    });

    it("maps DTO fields to entity camelCase fields", async () => {
      const created = makePersonnel();
      personnelRepo.create.mockReturnValue(created);
      personnelRepo.save.mockResolvedValue(created);

      await service.create(dto, adminUser);

      expect(personnelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Maria",
          lastName: "Santos",
          rank: "FO2",
        }),
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates allowed fields", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);
      personnelRepo.save.mockResolvedValue({ ...p, rank: "FO3" });

      const result = await service.update(10, { rank: "FO3" }, adminUser);

      expect(personnelRepo.save).toHaveBeenCalled();
      expect(result.rank).toBe("FO3");
    });

    it("station_user cannot change station_id", async () => {
      const p = makePersonnel({ stationId: stationUser.id });
      personnelRepo.findOne.mockResolvedValue(p);

      await expect(
        service.update(10, { station_id: 99 }, stationUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it("admin can change station_id", async () => {
      const p = makePersonnel({ stationId: 1 });
      personnelRepo.findOne.mockResolvedValue(p);
      personnelRepo.save.mockResolvedValue({ ...p, stationId: 99 });

      const result = await service.update(10, { station_id: 99 }, adminUser);
      expect(result.stationId).toBe(99);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes personnel with no face images without force flag", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);
      faceDataRepo.count.mockResolvedValue(0);
      personnelRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove(10, adminUser)).resolves.toBeUndefined();
      expect(personnelRepo.remove).toHaveBeenCalledWith(p);
    });

    it("throws BadRequestException when face images exist and force=false", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);
      faceDataRepo.count.mockResolvedValue(3);

      await expect(service.remove(10, adminUser, false)).rejects.toThrow(
        BadRequestException,
      );
      expect(personnelRepo.remove).not.toHaveBeenCalled();
    });

    it("deletes personnel with face images when force=true", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);
      faceDataRepo.count.mockResolvedValue(3);
      personnelRepo.remove.mockResolvedValue(undefined);

      await expect(
        service.remove(10, adminUser, true),
      ).resolves.toBeUndefined();
      expect(personnelRepo.remove).toHaveBeenCalledWith(p);
    });

    it("station_user cannot delete personnel from another station", async () => {
      const p = makePersonnel({ stationId: 99 });
      personnelRepo.findOne.mockResolvedValue(p);

      await expect(service.remove(10, stationUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── registerFace ─────────────────────────────────────────────────────────

  const validJpeg = `data:image/jpeg;base64,${"A".repeat(100)}`;
  const validPng = `data:image/png;base64,${"B".repeat(100)}`;
  const validImages = [validJpeg, validPng, validJpeg];

  describe("registerFace", () => {
    it("throws NotFoundException when personnel does not exist", async () => {
      personnelRepo.findOne.mockResolvedValue(null);
      await expect(
        service.registerFace(99, validImages, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException for unsupported MIME type", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);

      const badImages = ["data:image/gif;base64,R0lGOD", validJpeg, validJpeg];
      await expect(
        service.registerFace(10, badImages, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when an image exceeds 10 MB", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);

      // Build a base64 string longer than the 10 MB limit
      const oversized = `data:image/jpeg;base64,${"A".repeat(14_000_000)}`;
      await expect(
        service.registerFace(10, [oversized, validJpeg, validJpeg], adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("does NOT call faceService when validation fails", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);

      const badImages = ["data:image/bmp;base64,abc", validJpeg, validJpeg];
      await expect(
        service.registerFace(10, badImages, adminUser),
      ).rejects.toThrow(BadRequestException);

      expect(faceService.registerFace).not.toHaveBeenCalled();
    });

    it("saves embeddings returned by FaceService", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);

      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ];
      faceService.registerFace.mockResolvedValue({ embeddings });

      const fakeEntity = {
        personnelId: 10,
        embedding: embeddings[0],
        createdAt: new Date(),
      };
      faceEmbeddingRepo.create.mockReturnValue(fakeEntity);
      faceEmbeddingRepo.save.mockResolvedValue([fakeEntity]);

      await service.registerFace(10, validImages, adminUser);

      expect(faceService.registerFace).toHaveBeenCalledWith(10, validImages);
      expect(faceEmbeddingRepo.create).toHaveBeenCalledTimes(3);
      expect(faceEmbeddingRepo.save).toHaveBeenCalled();
    });

    it("propagates ServiceUnavailableException from FaceService", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);
      faceService.registerFace.mockRejectedValue(
        new ServiceUnavailableException("Face recognition service unavailable"),
      );

      await expect(
        service.registerFace(10, validImages, adminUser),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("station_user cannot register face for personnel in another station", async () => {
      const p = makePersonnel({ stationId: 99 }); // different station
      personnelRepo.findOne.mockResolvedValue(p);

      await expect(
        service.registerFace(10, validImages, stationUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it("accepts PNG images", async () => {
      const p = makePersonnel({ stationId: adminUser.id });
      personnelRepo.findOne.mockResolvedValue(p);

      const pngImages = [validPng, validPng, validPng];
      faceService.registerFace.mockResolvedValue({
        embeddings: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      });
      faceEmbeddingRepo.create.mockReturnValue({});
      faceEmbeddingRepo.save.mockResolvedValue([]);

      await expect(
        service.registerFace(10, pngImages, adminUser),
      ).resolves.toBeUndefined();
    });
  });
});
