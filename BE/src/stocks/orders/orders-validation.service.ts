import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/prisma/prisma.service";
import { BuyDto } from "./dtos/buy.dto";
import { SellDto } from "./dtos/sell.dto";
import { EditDto } from "./dtos/edit.dto";
import { CancelDto } from "./dtos/cancel.dto";

@Injectable()
export class OrdersValidationService {
    constructor(private readonly prisma : PrismaService) {}

    private tickSizeCheck(price) {
      let check = false;
      if (price >= 2000 && price < 5000) {
        if (price % 5 !== 0) check = true
      } 
      else if (price >= 5000 && price < 20000) {
        if (price % 10 !== 0) check = true
      } 
      else if (price >= 20000 && price < 500000) {
        if (price % 50 !== 0) check = true
      } 
      else if (price >= 50000 && price < 200000) {
        if (price % 100 !== 0) check = true
      } 
      else if (price >= 200000 && price < 500000) {
        if (price % 500 !== 0) check = true
      } 
      else if (price >= 500000) {
        if (price % 1000 !== 0) check = true
      }

      if (check) {
        return "잘못된 호가 단위 입니다";
      }
    }
  
    async accountCheck(data) {
      return await this.prisma.accounts.findUnique({
        where: { account_number: data.accountNumber },
        select : { 
          user_id : true,
          id : true,
          money : true
        }
      });
    }

    async getOrderValidate(query, user) {
      const accountCheck = await this.accountCheck(query);
      if (!accountCheck) {
        return "존재하지 않는 계좌 번호입니다";
      } else if (accountCheck.user_id != user.id) {
        return "요청한 계좌의 유저정보와 요청한 유저가 동일하지 않습니다";
      }
    }

    async buySellValidate(data : BuyDto | SellDto, user, tradingType) {
      let tickSizeCheck = await this.tickSizeCheck(data.price);
      if (tickSizeCheck) {
        return tickSizeCheck;
      }
      const accountCheck = await this.accountCheck(data);
      if (!accountCheck) {
        return "존재하지 않는 계좌번호입니다";
      } else if (accountCheck.user_id != user.id) {
        return "요청한 계좌의 유저정보와 요청한 유저가 동일하지 않습니다";
      }
      const stockIdCheck = await this.prisma.stocks.findUnique({
        where: { id: data.stockId },
        select: { id: true }
      });
      if (!stockIdCheck) {
        return "존재하지 않는 종목번호 입니다";
      } else if (data.price <= 0) {
        return "0원 이하의 주문은 불가능 합니다";
      } else if (data.number <= 0) {
        return "0주 이하의 주문은 불가능 합니다";
      }

      if (tradingType == "buy") {
        if (accountCheck.money < BigInt(data.price * data.number)) {
          // return "돈이 부족합니다";
        }
      }
      else {        
        const user_stocks = await this.prisma.user_stocks.findFirst({
          where : { account_id : accountCheck.id, stock_id : data.stockId }
        });
        if (!user_stocks || user_stocks.can_number < data.number) {
          return "보유한 주식이 모자랍니다";
        }
      }

    }

    async editValidate(data : EditDto, user) {
      let tickSizeCheck = await this.tickSizeCheck(data.price);
      if (tickSizeCheck) {
        return tickSizeCheck;
      }
      const accountCheck = await this.accountCheck(data);
      if (!accountCheck) {
        return "존재하지 않는 계좌번호입니다";
      } else if (accountCheck.user_id != user.id) {
        return "요청한 계좌의 유저정보와 요청한 유저가 동일하지 않습니다";
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
        return "존재하지 않는 주문입니다";
      } else if (orderCheck.account_id != accountCheck.id) {
        return "요청한 계좌와 주문이 접수된 계좌가 다릅니다";
      } else if (orderCheck.status == "c") {
        return "취소된 주문은 정정할수 없습니다";
      } else if (orderCheck.status == "y") {
        return "이미 체결된 주문은 정정할수 없습니다";
      } else if (data.price <= 0) {
        return "0원 이하로 정정할수 없습니다";
      }
    }

    async cancelValidate(data : CancelDto, user) {
      const accountCheck = await this.accountCheck(data);
      if (!accountCheck) {
        return "존재하지 않는 계좌번호입니다";
      } else if (accountCheck.user_id != user.id) {
        return "요청한 계좌의 유저정보와 요청한 유저가 동일하지 않습니다";
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
        return "존재하지 않는 주문입니다";
      } else if (orderCheck.account_id != accountCheck.id) {
        return "요청한 계좌의 유저정보와 요청한 유저가 동일하지 않습니다";
      } 
      else if (orderCheck.status == "y") {
        return "이미 체결된 주문은 취소할 수 없습니다";
      }
      else if (orderCheck.status == "c") {
        return "이미 취소된 주문입니다";
      }
    }
}