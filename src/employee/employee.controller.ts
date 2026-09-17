import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { EmployeeService } from './employee.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    if (createEmployeeDto.joinDate) {
      createEmployeeDto.joinDate = new Date(createEmployeeDto.joinDate);
    }
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  findAll() {
    return this.employeeService.findAll();
  }

  @Get('salary')
  getCompanySalary(@Query('date') date?: string) {
    return this.employeeService.calculateSalary(date);
  }

  @Get(':id/salary')
  getEmployeeSalary(@Param('id') id: string, @Query('date') date?: string) {
    return this.employeeService.calculateSalary(date, id);
  }
}
