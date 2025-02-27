import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { BuyDto } from "./dtos/buy.dto";
import { SellDto } from "./dtos/sell.dto";
import { EditDto } from "./dtos/edit.dto";
import { CancellDto } from "./dtos/cancell.dto";

@Injectable()
export class OrderValidationService {
    constructor(private readonly prisma : PrismaService) {}

    async getOrderValidate(query, user) {
      let errorNumber = 0;
      const accountCheck = await this.prisma.accounts.findUnique({
        where: { account_number: query.accountnumber },
        select : { user_id : true }
      });

      if (!accountCheck) {
        return errorNumber = 1;
      } else if (accountCheck.user_id != user.id) {
        return errorNumber = 2;
      }

      return errorNumber
    }

    async buySellValidate(data : BuyDto | SellDto, user) {
      let errorNumber = 0;  
      const accountCheck = await this.prisma.accounts.findUnique({
        where: { account_number: data.accountNumber },
        select : { user_id : true }
      });

      if (!accountCheck) {
        return errorNumber = 1;
      } else if (accountCheck.user_id != user.id) {
        return errorNumber = 2;
      }

      const stockIdCheck = await this.prisma.stocks.findUnique({
        where: { id: data.stockId },
        select: { id: true }
      });

      if (!stockIdCheck) {
        return errorNumber = 3;
      }

      if (data.number > 10000) {
        return errorNumber = 4;
      }

      if (data.price <= 0) {
        return errorNumber = 5;
      }

      return errorNumber = 0;
    }

    async editValidate(data : EditDto, user) {

    }

    async cancellValidate(data : CancellDto, user) {
      let errorNumber = 0;  
      const accountCheck = await this.prisma.accounts.findUnique({
        where: { account_number: data.accountNumber },
        select : { 
          id : true,
          user_id : true
        }
      });
      if (!accountCheck) {
        return errorNumber = 1;
      } else if (accountCheck.user_id != user.id) {
        return errorNumber = 2;
      }

      const orderCheck = await this.prisma.order.findUnique({
        where : {
          id : data.orderId
        },
        select : {
          account_id : true,
          status : true
        }
      });

      if (!orderCheck) {
        return errorNumber = 3;
      } else if (orderCheck.account_id != accountCheck.id) {
        return errorNumber = 4;
      } else if (orderCheck.status == "c") {
        return errorNumber = 5;
      }
      return errorNumber = 0;
    }
}