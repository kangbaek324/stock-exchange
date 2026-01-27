import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 예제: 기본 사용자 데이터 삽입
  await prisma.user.create({
    data : {
        username : "admin",
        password : "Strong@1!",
        email : "admin@gmail.com"
    }
  });

  await prisma.account.create({
    data : {
        userId : 1,
        accountNumber : 1000,
        money : 100000000
    }
  });

  await prisma.stock.createMany({
    data : [
        {name : "Nest소프트", price : 9500 }
    ]
  })

  console.log('✅ Seed data inserted successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

