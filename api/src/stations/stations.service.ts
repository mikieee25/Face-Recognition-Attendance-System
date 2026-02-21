import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Station } from "./station.entity";
import { CreateStationDto } from "./dto/create-station.dto";
import { UpdateStationDto } from "./dto/update-station.dto";

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(Station)
    private readonly stationRepo: Repository<Station>,
  ) {}

  /**
   * Return all stations (Requirement 12.1).
   */
  async findAll(): Promise<Station[]> {
    return this.stationRepo.find({ order: { id: "ASC" } });
  }

  /**
   * Create a new station (Requirements 12.2, 12.3, 12.4).
   */
  async create(dto: CreateStationDto): Promise<Station> {
    const station = this.stationRepo.create(dto);
    return this.stationRepo.save(station);
  }

  /**
   * Update an existing station (Requirement 12.2).
   */
  async update(id: number, dto: UpdateStationDto): Promise<Station> {
    const station = await this.stationRepo.findOne({ where: { id } });
    if (!station) throw new NotFoundException(`Station #${id} not found`);

    Object.assign(station, dto);
    return this.stationRepo.save(station);
  }

  /**
   * Remove a station (Requirement 12.2).
   */
  async remove(id: number): Promise<void> {
    const station = await this.stationRepo.findOne({ where: { id } });
    if (!station) throw new NotFoundException(`Station #${id} not found`);

    await this.stationRepo.remove(station);
  }
}
