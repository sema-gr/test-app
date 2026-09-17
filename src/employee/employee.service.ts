import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { EMPLOYEE_ROLE, BONUS_RATES } from './constants/employee.constants.js';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  private mapCreateEmployeeData(dto: CreateEmployeeDto) {
    return {
      name: dto.name,
      joinDate: new Date(dto.joinDate),
      baseSalary: dto.baseSalary,
      role: dto.role,
      managerId: dto.managerId,
      subordinates: dto.subordinates?.length ? {
        connect: dto.subordinates.map(id => ({ id }))
      } : undefined,
    };
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    if (createEmployeeDto.role === EMPLOYEE_ROLE.EMPLOYEE && createEmployeeDto.subordinates?.length) {
      throw new BadRequestException('Regular employees cannot have subordinates.');
    }

    if (createEmployeeDto.managerId && createEmployeeDto.subordinates?.includes(createEmployeeDto.managerId)) {
      throw new BadRequestException('A subordinate cannot be the manager of the same employee.');
    }

    if (createEmployeeDto.managerId) {

      const manager = await this.prisma.employee.findUnique({
        where: { id: createEmployeeDto.managerId },
      });

      if (!manager) {
        throw new BadRequestException('Manager not found');
      }

      if (manager.role === EMPLOYEE_ROLE.EMPLOYEE && createEmployeeDto.managerId) {
        throw new BadRequestException('Employee cannot be a manager.');
      }
    }
    return this.prisma.employee.create({
      data: this.mapCreateEmployeeData(createEmployeeDto),
      include: { subordinates: true },
    });
  }

  findAll() {
    return this.prisma.employee.findMany({
      include: { subordinates: true },
    });
  }

  async calculateSalary(dateStr?: string, employeeId?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();

    if (employeeId) {
      const salary = await this.getEmployeeSalary(employeeId, targetDate);
      return { employeeId, targetDate, salary };
    }

    const totalCompanySalary = await this.calculateCompanySalary(targetDate);
    return { targetDate, totalCompanySalary };
  }

  private async calculateCompanySalary(targetDate: Date): Promise<number> {
    const allEmployees = await this.prisma.employee.findMany();
    let totalCompanySalary = 0;
    
    for (const emp of allEmployees) {
      totalCompanySalary += await this.getEmployeeSalary(emp.id, targetDate);
    }
    
    return totalCompanySalary;
  }

  private diffYears(joinDate: Date, target: Date): number {
    let years = target.getFullYear() - joinDate.getFullYear();

    if (
      target.getMonth() < joinDate.getMonth() ||
      (target.getMonth() === joinDate.getMonth() && target.getDate() < joinDate.getDate())
    ) {
      years--;
    }
    return Math.max(0, years);
  }

  private async getEmployeeSalary(employeeId: string, targetDate: Date): Promise<number> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const years = this.diffYears(employee.joinDate, targetDate);
    const baseSalary = employee.baseSalary;

    if (employee.role === EMPLOYEE_ROLE.EMPLOYEE) {
      const bonus = Math.min(years * BONUS_RATES.EMPLOYEE.YEARLY_RATE, BONUS_RATES.EMPLOYEE.MAX_RATE);
      return baseSalary + (baseSalary * bonus);
    } 
    
    if (employee.role === EMPLOYEE_ROLE.MANAGER) {
      const bonus = Math.min(years * BONUS_RATES.MANAGER.YEARLY_RATE, BONUS_RATES.MANAGER.MAX_RATE);
      const salaryWithBonus = baseSalary + (baseSalary * bonus);
      
      const directSubordinates = await this.prisma.employee.findMany({
        where: { managerId: employee.id },
      });
      
      let subordinatesSalary = 0;
      for (const sub of directSubordinates) {
        subordinatesSalary += await this.getEmployeeSalary(sub.id, targetDate);
      }
      
      return salaryWithBonus + (subordinatesSalary * BONUS_RATES.MANAGER.SUBORDINATE_RATE);
    } 
    
    if (employee.role === EMPLOYEE_ROLE.SALES) {
      const bonus = Math.min(years * BONUS_RATES.SALES.YEARLY_RATE, BONUS_RATES.SALES.MAX_RATE);
      const salaryWithBonus = baseSalary + (baseSalary * bonus);
      
      const allSubordinatesSalary = await this.getAllDescendantsSalary(employee.id, targetDate);
      return salaryWithBonus + (allSubordinatesSalary * BONUS_RATES.SALES.SUBORDINATE_RATE);
    }

    return 0;
  }

  private async getAllDescendantsSalary(managerId: string, targetDate: Date): Promise<number> {
    const directSubordinates = await this.prisma.employee.findMany({
      where: { managerId },
    });
    
    let total = 0;
    for (const sub of directSubordinates) {
      total += await this.getEmployeeSalary(sub.id, targetDate);
      total += await this.getAllDescendantsSalary(sub.id, targetDate);
    }
    
    return total;
  }
}
