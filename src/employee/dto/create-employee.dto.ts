import { EmployeeType } from "@prisma/client";

export class CreateEmployeeDto {
  name: string;
  joinDate: Date;
  baseSalary: number;
  role: EmployeeType;
  managerId?: string;
  subordinates?: string[];
}
