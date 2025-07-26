// prisma/seed.ts
import { PrismaClient, UserRole, BinStatus, DriverStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartwaste.com' },
    update: {},
    create: {
      email: 'admin@smartwaste.com',
      passwordHash: adminPassword,
      fullName: 'System Administrator',
      phone: '+23276123456',
      role: UserRole.ADMIN,
      emailVerified: true,
    },
  });

  // Create sample truck
  const truck = await prisma.truck.create({
    data: {
      licensePlate: 'SW-001',
      model: 'Mercedes Atego',
      capacity: 5000,
    },
  });

  // Create driver user
  const driverPassword = await bcrypt.hash('driver123', 12);
  const driverUser = await prisma.user.create({
    data: {
      email: 'driver@smartwaste.com',
      passwordHash: driverPassword,
      fullName: 'John Driver',
      phone: '+23276654321',
      role: UserRole.DRIVER,
      emailVerified: true,
    },
  });

  // Create driver profile
  const driver = await prisma.driver.create({
    data: {
      userId: driverUser.id,
      driverLicense: 'DL123456',
      truckId: truck.id,
      status: DriverStatus.OFFLINE,
      shiftStart: '08:00',
      shiftEnd: '17:00',
    },
  });

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.create({
    data: {
      email: 'user@smartwaste.com',
      passwordHash: userPassword,
      fullName: 'Jane User',
      phone: '+23276789012',
      role: UserRole.USER,
      emailVerified: true,
    },
  });

  // Create sample bins
  const bins = [
    {
      binCode: 'BC1001',
      location: 'Fourah Bay College - Main Gate',
      latitude: 8.4840,
      longitude: -13.2299,
      currentLevel: 25.5,
      status: BinStatus.LOW,
      userId: user.id,
    },
    {
      binCode: 'BC1002', 
      location: 'Aberdeen - Market Street',
      latitude: 8.4950,
      longitude: -13.2410,
      currentLevel: 78.2,
      status: BinStatus.HIGH,
      userId: user.id,
    },
    {
      binCode: 'BC1003',
      location: 'Electrical Department FBC',
      latitude: 8.4845,
      longitude: -13.2305,
      currentLevel: 5.0,
      status: BinStatus.EMPTY,
      userId: user.id,
    },
  ];

  for (const binData of bins) {
    await prisma.bin.create({ data: binData });
  }

  console.log('✅ Database seeded successfully!');
  console.log('👤 Admin: admin@smartwaste.com / admin123');
  console.log('🚛 Driver: driver@smartwaste.com / driver123');
  console.log('👥 User: user@smartwaste.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });