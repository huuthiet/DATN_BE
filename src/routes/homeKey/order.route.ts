import * as express from "express";

import AuthMiddleware from "../../middlewares/auth";
import OrderController from "../../controllers/homeKey/order";
import TransactionsController from "../../controllers/homeKey/transactions";

const orderRoute = express.Router();


orderRoute
    .route("/getPayDepositList/:id")
    .get(OrderController.getPayDepositList);

//Phiên bản V1 là: getOrderListByHost
orderRoute
  .route("/orderDeposit/list/host/:id")
  .get(OrderController.getOrderDepositListByHostV2);
// Login



orderRoute.use(AuthMiddleware.isAuthenticated);

orderRoute
  .route("/postTransactionAfterCheckInCostPendingBanking/")
  .post(TransactionsController.postTransactionAfterCheckInCostPendingBanking)

//user
orderRoute
  .route("/bankingCashTransactionsList/")
  .get(TransactionsController.getBankingCashTransactionsList);

//--------------------------------------------------------------------
orderRoute.use(AuthMiddleware.isHost);

//hosts
orderRoute
  .route("/bankingCashPendingDepositListByMotel/:id")
  .get(TransactionsController.getBankingCashPendingDepositListByMotel)

orderRoute
  .route("/bankingCashPendingAfterCheckInCostListByMotel/:id")
  .get(TransactionsController.getBankingCashPendingAfterCheckInCostListByMotel)

orderRoute
  .route("/bankingCashPendingMonthlyByMotel/:id")
  .get(TransactionsController.getBankingCashPendingMonthlyByMotel)
  
orderRoute
  .route("/putBankingCashPendingTransactionByMotel/:id")
  .put(TransactionsController.putBankingCashPendingTransactionByMotel);
  
orderRoute
  .route("/payDeposit/:id")
  .put(TransactionsController.putPayDeposit);



/* ------------------------------ PRIVATE APIS ------------------------------ */

export default orderRoute;


