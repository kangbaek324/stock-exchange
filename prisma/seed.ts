import { PrismaClient } from '@prisma/client';
import { PrismaClientValidationError } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  // 예제: 기본 사용자 데이터 삽입
  await prisma.users.create({
    data : {
        username : "admin",
        password : "Strong@1!",
        email : "admin@gmail.com"
    }
  });

  await prisma.accounts.create({
    data : {
        user_id : 1,
        account_number : 1000,
        money : 100000000
    }
  });

  await prisma.stocks.createMany({
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

