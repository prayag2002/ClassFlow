import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../entities';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
  ) {}

  async findAll(): Promise<Course[]> {
    return this.courseRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Course with ID "${id}" not found`);
    }
    return course;
  }

  async create(data: { title: string; description?: string }): Promise<Course> {
    const course = this.courseRepo.create(data);
    return this.courseRepo.save(course);
  }
}
