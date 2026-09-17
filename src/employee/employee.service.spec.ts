import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './employee.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMPLOYEE_ROLE } from './constants/employee.constants.js';

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    async $connect() {}
  },
}));

describe('EmployeeService', () => {
  let service: EmployeeService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: PrismaService,
          useValue: {
            employee: {
              findMany: vi.fn(),
              findUnique: vi.fn(),
              create: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw error if regular employee has subordinates', async () => {
      await expect(service.create({
        name: 'Test',
        joinDate: new Date(),
        baseSalary: 1000,
        role: EMPLOYEE_ROLE.EMPLOYEE,
        subordinates: ['sub-1']
      })).rejects.toThrow('Regular employees cannot have subordinates.');
    });

    it('should throw error if subordinate is also the manager (cyclic)', async () => {
      await expect(service.create({
        name: 'Test',
        joinDate: new Date(),
        baseSalary: 1000,
        role: EMPLOYEE_ROLE.MANAGER,
        managerId: 'cycle-id',
        subordinates: ['sub-1', 'cycle-id']
      })).rejects.toThrow('A subordinate cannot be the manager of the same employee.');
    });

    it('should call prisma.create with connect for subordinates', async () => {
      (prisma.employee.create as any).mockResolvedValue({ id: 'new-id' });
      
      const dto = {
        name: 'Manager',
        joinDate: new Date('2024-01-01'),
        baseSalary: 2000,
        role: EMPLOYEE_ROLE.MANAGER,
        subordinates: ['sub-1', 'sub-2']
      };

      await service.create(dto);
      
      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Manager',
          role: EMPLOYEE_ROLE.MANAGER,
          subordinates: {
            connect: [{ id: 'sub-1' }, { id: 'sub-2' }]
          }
        }),
        include: { subordinates: true }
      });
    });
  });

  describe('calculateSalary', () => {
    it('should calculate EMPLOYEE salary correctly', async () => {
      const mockEmployees = [
        {
          id: '1',
          name: 'Emp',
          joinDate: new Date('2020-01-01'),
          baseSalary: 1000,
          role: EMPLOYEE_ROLE.EMPLOYEE,
          managerId: null,
        },
      ];
      (prisma.employee.findUnique as any).mockImplementation(async ({ where }: any) => mockEmployees.find(e => e.id === where.id));

      (prisma.employee.findMany as any).mockImplementation(async (args: any = {}) => {
        if (args.where?.managerId) return mockEmployees.filter(e => e.managerId === args.where.managerId);
        return mockEmployees;
      });

      const result = await service.calculateSalary('2024-01-01', '1');
      expect(result.salary).toBe(1120);
    });

    it('should calculate MANAGER salary correctly', async () => {
      const mockEmployees = [
        {
          id: '1',
          name: 'Manager',
          joinDate: new Date('2020-01-01'),
          baseSalary: 2000,
          role: EMPLOYEE_ROLE.MANAGER,
          managerId: null,
        },
        {
          id: '2',
          name: 'Emp1',
          joinDate: new Date('2020-01-01'),
          baseSalary: 1000,
          role: EMPLOYEE_ROLE.EMPLOYEE,
          managerId: '1',
        },
        {
          id: '3',
          name: 'Emp2',
          joinDate: new Date('2020-01-01'),
          baseSalary: 1000,
          role: EMPLOYEE_ROLE.EMPLOYEE,
          managerId: '1',
        },
      ];
      (prisma.employee.findUnique as any).mockImplementation(async ({ where }: any) => mockEmployees.find(e => e.id === where.id));

      (prisma.employee.findMany as any).mockImplementation(async (args: any = {}) => {
        if (args.where?.managerId) return mockEmployees.filter(e => e.managerId === args.where.managerId);
        return mockEmployees;
      });

      const result = await service.calculateSalary('2024-01-01', '1');
      expect(result.salary).toBe(2411.2);
    });

    it('should calculate SALES salary correctly including indirect subordinates', async () => {
      const mockEmployees = [
        {
          id: '1',
          name: 'SalesManager',
          joinDate: new Date('2020-01-01'),
          baseSalary: 3000,
          role: EMPLOYEE_ROLE.SALES,
          managerId: null,
        },
        {
          id: '2',
          name: 'Manager',
          joinDate: new Date('2020-01-01'),
          baseSalary: 2000,
          role: EMPLOYEE_ROLE.MANAGER,
          managerId: '1',
        },
        {
          id: '3',
          name: 'Emp1',
          joinDate: new Date('2020-01-01'),
          baseSalary: 1000,
          role: EMPLOYEE_ROLE.EMPLOYEE,
          managerId: '2', 
        },
      ];
      (prisma.employee.findUnique as any).mockImplementation(async ({ where }: any) => mockEmployees.find(e => e.id === where.id));

      (prisma.employee.findMany as any).mockImplementation(async (args: any = {}) => {
        if (args.where?.managerId) return mockEmployees.filter(e => e.managerId === args.where.managerId);
        return mockEmployees;
      });

      const result = await service.calculateSalary('2024-01-01', '1');
      expect(result.salary).toBeCloseTo(3130.5768, 4);
    });
    
    it('should enforce maximum bonus limits', async () => {
      const mockEmployees = [
        {
          id: '1',
          name: 'OldEmployee',
          joinDate: new Date('2000-01-01'),
          baseSalary: 1000,
          role: EMPLOYEE_ROLE.EMPLOYEE,
          managerId: null,
        },
      ];
      (prisma.employee.findUnique as any).mockImplementation(async ({ where }: any) => mockEmployees.find(e => e.id === where.id));
      
      (prisma.employee.findMany as any).mockImplementation(async (args: any = {}) => {
        if (args.where?.managerId) return mockEmployees.filter(e => e.managerId === args.where.managerId);
        return mockEmployees;
      });

      const result = await service.calculateSalary('2024-01-01', '1');
      expect(result.salary).toBe(1300);
    });
  });
});
