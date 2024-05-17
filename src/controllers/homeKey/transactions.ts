import { NextFunction, Request, Response } from "express";
const { ObjectId } = require('mongodb');
import * as moment from "moment";
import * as lodash from "lodash";
import { helpers } from "../../utils";
import ImageService from "../../services/image";
import HttpResponse from "../../services/response";
import RoomController from "./room";
import e = require("express");
import sendMail from "../../utils/Mailer/mailer";
import JobController from "./job.controller";
import * as rn from "random-number";
import * as bcrypt from "bcryptjs";
var optionsNumbeer = {
  // example input , yes negative values do work
  min: 1000,
  max: 9999,
};
var options = [
  {
    key: "AGB",
    value: "AGB",
    label: "Ngân hàng Nông nghiệp và Phát triển Nông thôn (Agribank)",
  },
  {
    key: "BIDV",
    value: "BIDV",
    label: "Ngân hàng Đầu tư và Phát triển Việt Nam (BIDV)",
  },
  {
    key: "VBB",
    value: "VBB",
    label: "Ngân hàng TMCP Công Thương Việt Nam (Vietbank)",
  },
  { key: "ACB", value: "ACB", label: "Ngân hàng TMCP Á Châu (ACB)" },
  { key: "MB", value: "MB", label: "Ngân hàng TMCP Quân Đội (MB)" },
  { key: "SCB", value: "SCB", label: "Ngân hàng TMCP Sài Gòn (SCB)" },
  {
    key: "TPB",
    value: "TPB",
    label: "Ngân hàng TMCP Tiên Phong (TPBank)",
  },
  {
    key: "DAB",
    value: "DAB",
    label: "Ngân hàng TMCP Đông Á (DongA Bank)",
  },
  { key: "BAB", value: "BAB", label: "Ngân hàng TMCP Bắc Á (BacABank)" },
  {
    key: "MSB",
    value: "MSB",
    label: "Ngân hàng TMCP Hàng Hải (Maritime Bank)",
  },
  {
    key: "TCB",
    value: "TCB",
    label: "Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)",
  },
  {
    key: "VPB",
    value: "VPB",
    label: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)",
  },
  {
    key: "SHB",
    value: "SHB",
    label: "Ngân hàng TMCP Sài Gòn-Hà Nội (SHB)",
  },
  {
    key: "OJB",
    value: "OJB",
    label: "Ngân hàng TMCP Đại Dương (OceanBank)",
  },
  { key: "NCB", value: "NCB", label: "Ngân hàng NCB" },
  { key: "EXIMBANK", value: "EXIMBANK", label: "Ngân hàng EximBank" },
  { key: "MSBANK", value: "MSBANK", label: "Ngân hàng MSBANK" },
  { key: "NAMABANK", value: "NAMABANK", label: "Ngân hàng NamABank" },
  { key: "VNMART", value: "VNMART", label: "Vi điện tử VnMart" },
  {
    key: "VIETINBANK",
    value: "VIETINBANK",
    label: "Ngân hàng Vietinbank",
  },
  { key: "VIETCOMBANK", value: "VIETCOMBANK", label: "Ngân hàng VCB" },
  { key: "HDBANK", value: "HDBANK", label: "Ngân hàng HDBank" },
  { key: "DONGABANK", value: "DONGABANK", label: "Ngân hàng Đông Á" },
  { key: "TPBANK", value: "TPBANK", label: "Ngân hàng TPBank" },
  { key: "OJB", value: "OJB", label: "Ngân hàng OceanBank" },
  {
    key: "TECHCOMBANK",
    value: "TECHCOMBANK",
    label: "Ngân hàng Techcombank",
  },
  { key: "VPBANK", value: "VPBANK", label: "Ngân hàng VPBank" },
  { key: "SACOMBANK", value: "SACOMBANK", label: "Ngân hàng SacomBank" },
  { key: "OCB", value: "OCB", label: "Ngân hàng OCB" },
  { key: "IVB", value: "IVB", label: "Ngân hàng IVB" },
  { key: "VISA", value: "VISA", label: "Thanh toán qua VISA/MASTER" },
];

export default class TransactionsController {
  static async postTransactionPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { transactions: TransactionsModel } = global.mongoModel;
      const { user: userModel } = global.mongoModel;

      const id = req.params.id;

      let { body: data } = req;
      let resData = await userModel
        .findOne(
          { _id: req["userId"], isDeleted: false },
          { password: 0, token: 0 }
        )
        .populate("avatar identityCards")
        .lean()
        .exec();
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tài khoản không tồn tại"
        );
      }
      const transactionsData = await TransactionsModel.create({
        user: req["userId"],
        keyPayment: data.keyPayment,
        description: `Chuyển tiền vào tài khoản ${resData.lastName} ${resData.firstName}`,
        amount: data.amount,
        status: "waiting",
        paymentMethod: data.type,
      });
      // Get ip
      data["ipAddr"] =
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.socket.remoteAddress;

      return HttpResponse.returnSuccessResponse(res, transactionsData);
    } catch (e) {
      next(e);
    }
  }
  static async postTransactionsPendingBanking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { 
        transactions: TransactionsModel,
        order: orderModel,
        user: userModel,
        room: roomModel,
        motelRoom: motelRoomModel,
        floor: floorModel,
        job: jobModel,
       } = global.mongoModel;
      
      const id = req.params.id;

      let { body: formData } = req;

      const roomData = await RoomController.getRoomById(formData.roomId);

      if (roomData && roomData.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          roomData.errors[0].errorMessage
        );
      }

      if (!roomData.isCompleted) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Phòng chưa hoàn thành"
        );
      }

      if (roomData.status !== "available") {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Phòng Đã Được Đặt"
        );
      }

      const dayID = moment(roomData.availableDate).format("DD/MM/YYYY");

      if (
        moment(formData.checkInTime, "MM-DD-YYYY").isBefore(
          moment(dayID, "MM-DD-YYYY")
        )
      ) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Thời gian bắt đầu thuê nhỏ hơn ngày hiện tại"
        );
      }

      const myDateOld = formData.checkInTime;

      const dateOld = myDateOld.split("/")[0];
      const monthOld = myDateOld.split("/")[1];
      const yearOld = myDateOld.split("/")[2];

      const stringDate = `${dateOld}-${monthOld}-${yearOld}`;
      let date = new Date(
        stringDate.replace(/(\d{2})-(\d{2})-(\d{4})/, "$2/$1/$3")
      );
      const myDateNew = date;
      formData.checkInTime = myDateNew;
      formData.room = roomData._id;
      formData.user = req["userId"];

      const floorData = await floorModel
        .findOne({ rooms: formData.roomId })
        .lean()
        .exec();

      if (!floorData) {
        return HttpResponse.returnBadRequestResponse(res, "Tầng không hợp lệ");
      }

      const motelRoomData = await motelRoomModel
        .findOne({ floors: floorData._id })
        .lean()
        .exec();

      if (!motelRoomData) {
        return HttpResponse.returnBadRequestResponse(res, "Phòng không hợp lệ");
      }
      let resData = await jobModel.create(formData);
      let userUpdateData = {
        $addToSet: {
          jobs: resData._id,
        },
      };

      if (
        req["userProfile"].phoneNumber.number ===
        helpers.stripeZeroOut(formData.phoneNumber)
      ) {
        userUpdateData["currentJob"] = resData._id;
        userUpdateData["room"] = roomData._id;
      }

      await userModel
        .findOneAndUpdate({ _id: req["userId"] }, userUpdateData, { new: true })
        .exec();

      await floorModel
        .findOneAndUpdate(
          { _id: floorData._id },
          {
            $inc: {
              availableRoom: -1,
              depositedRoom: 1,
            },
          }
        )
        .exec();
      await motelRoomModel
        .findOneAndUpdate(
          { _id: floorData._id },
          {
            $inc: {
              availableRoom: -1,
              depositedRoom: 1,
            },
          }
        )
        .exec();



      const orderData = await orderModel.create({
        user: req["userId"],
        job: resData._id,
        isCompleted: false,
        description: `Tiền cọc phòng tháng ${myDateOld.split("/")[1]}/${myDateOld.split("/")[2]
          }`,
        amount: formData.deposit,
        type: "deposit",
      });

      resData = await jobModel.findOneAndUpdate(
        { _id: resData._id },
        {
          isCompleted: orderData.isCompleted,
          $addToSet: { orders: orderData._id },
          currentOrder: orderData._id,
        },
        { new: true }
      );

      // let resData = await userModel
      //   .findOne(
      //     { _id: req["userId"], isDeleted: false },
      //     { password: 0, token: 0 }
      //   )
      //   .populate("avatar identityCards")
      //   .lean()
      //   .exec();
      // if (!resData) {
      //   return HttpResponse.returnBadRequestResponse(
      //     res,
      //     "Tài khoản không tồn tại"
      //   );
      // }
      const transactionsData = await TransactionsModel.create({
        user: req["userId"],
        keyPayment: formData.keyPayment,
        description: `Tiền cọc phòng tháng ${myDateOld.split("/")[1]}/${myDateOld.split("/")[2]}`,
        amount: orderData.amount,
        status: "waiting",
        paymentMethod: formData.type,
        order: orderData._id,
        banking: formData.banking,
        type: "deposit",
        motel: motelRoomData._id,
        room: roomData._id,
      });
      // Get ip
      // formData["ipAddr"] =
      //   req.headers["x-forwarded-for"] ||
      //   req.connection.remoteAddress ||
      //   req.socket.remoteAddress ||
      //   req.socket.remoteAddress;

      return HttpResponse.returnSuccessResponse(res, transactionsData);
    } catch (e) {
      next(e);
    }
  }

  static async getBankingCashPendingDepositListByMotel (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<any> {
    try {
      // const id = req.params.id;
      const idMotel = req.params.id;

      console.log({idMotel});
      const {
        user: userModel,
        transactions: TransactionsModel,
        image: imageModel,
        room: roomModel,
      } = global.mongoModel;

      const transactionsData = await TransactionsModel.find({
        motel: ObjectId(idMotel),
        type: "deposit",
        paymentMethod: { $ne: "wallet" },
        isDeleted: false,
        status: "waiting",
      }).populate("user").lean().exec();

      console.log({transactionsData})
      if (transactionsData) {
        for (let i = 0; i < transactionsData.length; i++) {
            if (transactionsData[i].file) {
              const dataimg = await imageModel.findOne({
                _id: transactionsData[i].file,
              });
              if (dataimg) {
                transactionsData[i].file = await helpers.getImageUrl(dataimg);
              }
            }     
            
            // if(transactionsData[i].motel) {
            //   const motelData = await motelRoomModel.findOne({_id: transactionsData[i].motel}).populate("owner").lean().exec();
            //   if(motelData) {
            //     transactionsData[i].motel = motelData;
            //   }
            // }

            if(transactionsData[i].room) {
              const roomData = await roomModel.findOne({_id: transactionsData[i].room}).lean().exec();
              if(roomData) {
                transactionsData[i].room = roomData;
              }
            }
        }
      }

      if (!transactionsData) {
        return HttpResponse.returnBadRequestResponse(res, "logPayment");
      }

      return HttpResponse.returnSuccessResponse(res, transactionsData);
    } catch (error) {
      next(error);
    }
  }

  static async getBankingCashTransactionsList (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<any> {
    try {
      // const id = req.params.id;
      const id = req["userId"];

      console.log({id});
      const {
        user: userModel,
        transactions: TransactionsModel,
        image: imageModel,
        motelRoom: motelRoomModel,
        room: roomModel,
      } = global.mongoModel;

      const userData = await userModel.findOne({_id: id}).lean().exec();
      console.log({userData})
      if (!userData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tài khoản người dùng không tồn tại"
        );
      }

      const transactionsData = await TransactionsModel.find({
        user: id,
        type: { $ne: "recharge" },
        paymentMethod: { $ne: "wallet" },
        isDeleted: false,
      }).lean().exec();

      if (transactionsData) {
        for (let i = 0; i < transactionsData.length; i++) {
            if (transactionsData[i].file) {
              const dataimg = await imageModel.findOne({
                _id: transactionsData[i].file,
              });
              if (dataimg) {
                transactionsData[i].file = await helpers.getImageUrl(dataimg);
              }
            }     
            
            if(transactionsData[i].motel) {
              const motelData = await motelRoomModel.findOne({_id: transactionsData[i].motel}).populate("owner").lean().exec();
              if(motelData) {
                transactionsData[i].motel = motelData;
              }
            }

            if(transactionsData[i].room) {
              const roomData = await roomModel.findOne({_id: transactionsData[i].room}).lean().exec();
              if(roomData) {
                transactionsData[i].room = roomData;
              }
            }
        }
      }

      if (!transactionsData) {
        return HttpResponse.returnBadRequestResponse(res, "logPayment");
      }
      // console.log({transactionsData});

      return HttpResponse.returnSuccessResponse(res, transactionsData);
    } catch (error) {
      next(error);
    }
  }


  static async putPayDeposit(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { payDepositList: PayDepositListModel } = global.mongoModel;

      const id = req.params.id;
      console.log({id});

      let { body: data } = req;

      let resData = await PayDepositListModel.findOne({
        _id: ObjectId(id),
        isDeleted: false,
      })
        .lean()
        .exec();
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Giao dịch không tồn tại"
        );
      }

      const resDataS = await PayDepositListModel.findOneAndUpdate(
        { _id: id },
        { status: data.status }
      )
        .lean()
        .exec();
      // Get ip
      data["ipAddr"] =
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.socket.remoteAddress;
      return HttpResponse.returnSuccessResponse(res, resDataS);
    } catch (e) {
      next(e);
    }
  }

  static async putBankingCashPendingDeposit(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { 
        transactions: TransactionsModel,
        order: orderModel,
        user: userModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;

      const id = req.params.id;
      console.log({id});

      let { body: data } = req;

      console.log({data});

      let resData = await TransactionsModel.findOne({
        _id: ObjectId(id),
        isDeleted: false,
      })
        .lean()
        .exec();
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Giao dịch không tồn tại"
        );
      }

      //TRƯỜNG HỢP HỦY VÀ TRƯỜNG HỢP ĐỒNG Ý
      const resDataS = await TransactionsModel.findOneAndUpdate(
        { _id: id },
        { status: data.status },
        {new: true}
      )
        .lean()
        .exec();

      if (resDataS.status === "success") {
        const orderData = await orderModel
          .findOne({ _id: resDataS.order })
          .lean()
          .exec();

        if (!orderData) {
          return HttpResponse.returnBadRequestResponse(
            res,
            "Hóa đơn không tồn tại"
          );
        }

        if (orderData.isCompleted) {
          return HttpResponse.returnBadRequestResponse(
            res,
            "Hóa đơn đã được thanh toán!"
          );
        }

        if (orderData.type === "monthly") {
          const JobData = await jobModel
            .findOne({ _id: orderData.job })
            .populate("room")
            .lean()
            .exec();
          const RoomData = await roomModel
            .findOne({ _id: JobData.room._id })
            .lean()
            .exec();
          await jobModel
            .findOneAndUpdate(
              { _id: orderData.job },
              {
                isCompleted: true,
                roomPassword: RoomData.roomPassword,
                // roomPassword: helpers.generateVerifyCode(),
                status: "monthlyPaymentCompleted",
              }
            )
            .exec();
        }

        // dặt cọc
        if (orderData.type === "deposit") {
          const jobData = await jobModel
            .findOne({ _id: orderData.job })
            .populate("room")
            .lean()
            .exec();
          if (jobData.room.status === "available") {
            await roomModel
              .findOneAndUpdate(
                { _id: jobData.room._id },
                { status: "deposited", rentedBy: jobData.user },
                { new: true }
              )
              .exec();

            let floorData = await floorModel
              .findOne({ rooms: jobData.room._id })
              .populate("rooms")
              .lean()
              .exec();
            const roomGroup = lodash.groupBy(floorData.rooms, (room) => {
              return room.status;
            });

            await floorModel
              .findOneAndUpdate(
                { _id: floorData._id },
                {
                  availableRoom: roomGroup["available"]
                    ? roomGroup["available"].length
                    : 0,
                  rentedRoom: roomGroup["rented"]
                    ? roomGroup["rented"].length
                    : 0,
                  depositedRoom: roomGroup["deposited"]
                    ? roomGroup["deposited"].length
                    : 0,
                }
              )
              .exec();

            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();

            let updateData = {
              availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
              rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
              depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
            };

            await motelRoomModel
              .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
              .exec();

            const jobRes = await jobModel
              .findOneAndUpdate(
                { _id: orderData.job },
                {
                  isCompleted: true,
                  status: "pendingActivated",
                },
                { new: true }
              )
              .exec();
          }
        }

        if (orderData.type === "afterCheckInCost") {
          const JobData = await jobModel
            .findOne({ _id: orderData.job })
            .populate("room")
            .lean()
            .exec();
          const RoomData = await roomModel
            .findOne({ _id: JobData.room._id })
            .lean()
            .exec();
          await jobModel
            .findOneAndUpdate(
              { _id: orderData.job },
              {
                roomPassword: RoomData.roomPassword,
                // roomPassword: helpers.generateVerifyCode(),
                status: "pendingMonthlyPayment",
              }
            )
            .exec();
  
          const jobData = await JobController.getJobNoImg(orderData.job);
  
          // await NotificationController.createNotification({
          //   title: "Thông báo đóng tiền phòng",
          //   content: "Vui lòng thanh toán tiền phòng trong vòng 5 ngày.",
          //   user: jobData.user,
          // });

  
          // SỬA: chỗ này cần tạo 1 job để tạo bill tháng đó vào cuối tháng, để có thể bao gồm tiền phòng
          // await global.agendaInstance.agenda.schedule(
          //   moment()
          //     .startOf("month")
          //     .add("1", "months")
          //     .toDate(),
          //   "CreateFirstMonthOrder",
          //   { jobId: jobData._id }
          // );
  
          await global.agendaInstance.agenda.schedule(
            moment().add("2", 'minutes').toDate(),
            'CreateFirstMonthOrder',
            { jobId: jobData._id }
          );
  
  
          // const newOrderData = await orderModel.create({
          //   user: jobData.user,
          //   job: jobData._id,
          //   isCompleted: false,
          //   // description: `Tiền phòng tháng ${moment().month() + 1}/${moment().year()} `,
          //   description: `Tiền phòng tháng ${dayGet.getMonth() + 1}/${dayGet.getFullYear()} `,
          //   amount: Math.floor(
          //     (jobData.room.price / moment(jobData.checkInTime).daysInMonth()) *
          //       moment(jobData.checkInTime)
          //         .endOf("month")
          //         .diff(moment(jobData.checkInTime), "days")
          //   ),
          //   type: "monthly",
          // });
  
          // await jobModel
          //   .findOneAndUpdate(
          //     { _id: jobData._id },
          //     {
          //       $addToSet: { orders: newOrderData._id },
          //       currentOrder: newOrderData._id,
          //       status: "pendingMonthlyPayment",
          //     }
          //   )
          //   .exec();
  
        }

        await orderModel
          .findOneAndUpdate(
            { _id: resDataS.order },
            {
              isCompleted: true,
              paymentMethod: "cash",
            },
            { new: true }
          )
          .lean()
          .exec()

        return  HttpResponse.returnSuccessResponse(res, resDataS);
      } else if (resDataS.status === "cancel") {
        const orderData = await orderModel
          .findOne({ _id: resDataS.order })
          .lean()
          .exec();

        if (!orderData) {
          return HttpResponse.returnBadRequestResponse(
            res,
            "Hóa đơn không tồn tại"
          );
        }

        if (orderData.isCompleted) {
          return HttpResponse.returnBadRequestResponse(
            res,
            "Hóa đơn đã được thanh toán!"
          );
        }

        //note: tạm thời xóa đi job
        await jobModel.remove({_id: orderData.job}).lean().exec();

        //xóa job ra khỏi user

        let userUpdateData = {
          $pull: {
            jobs: orderData.job,
          },
        };

        await userModel
          .findOneAndUpdate({ _id: resDataS.user }, userUpdateData, { new: true })
          .exec();

        return HttpResponse.returnSuccessResponse(res, resDataS);
      }

      return HttpResponse.returnSuccessResponse(res, resDataS);
    } catch (e) {
      next(e);
    }
  }

  static async putTransactionPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { transactions: TransactionsModel } = global.mongoModel;
      const { user: userModel } = global.mongoModel;

      const id = req.params.id;

      let { body: data } = req;

      let resData = await TransactionsModel.findOne({
        _id: id,
        isDeleted: false,
      })
        .lean()
        .exec();
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tài khoản không tồn tại"
        );
      }
      // find user
      const rsuser = await userModel
        .findOne({ _id: resData.user })
        .lean()
        .exec();
      if (!rsuser) {
        return HttpResponse.returnBadRequestResponse(res, "Không tồn tại user");
      }

      if (data.status === "success") {
        const userData = await userModel
          .findOneAndUpdate(
            {
              _id: resData.user,
            },
            {
              $set: {
                wallet: rsuser.wallet + resData.amount,
              },
            },
            {
              new: true,
            }
          )
          .lean()
          .exec();
        if (!userData) {
          return HttpResponse.returnBadRequestResponse(
            res,
            "Không cập nhật được tiền"
          );
        }
      }

      const resDataS = await TransactionsModel.findOneAndUpdate(
        { _id: id },
        { status: data.status }
      )
        .lean()
        .exec();
      // Get ip
      data["ipAddr"] =
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.socket.remoteAddress;
      return HttpResponse.returnSuccessResponse(res, resDataS);
    } catch (e) {
      next(e);
    }
  }
  static async getTransactionPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const { transactions: TransactionsModel } = global.mongoModel;
      let { sortBy, size, page, keyword } = req.query;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "images",
            localField: "file",
            foreignField: "_id",
            as: "images",
          },
        },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];

      if (sortBy && sortType) {
        switch (sortBy) {
          case "createdAt": {
            sort = { createdAt: sortType };
            break;
          }
          case "updatedAt": {
            sort = { updatedAt: sortType };
            break;
          }
          default:
            sort = { createdAt: -1 };
        }
        condition.push({ $sort: sort });
      }

      const resData = await TransactionsModel.paginate(size, page, condition);

      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "Không có danh sách");
      }
      for (let i = 0; i < resData.data.length; i++) {
        if (resData.data[i].images.length > 0) {
          resData.data[i].images = helpers.getImageUrl(
            resData.data[i].images,
            true
          );
        }
      }

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  static async getTransactionPaymentHost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`

      const {
        room: roomModel,
        motelRoom: motelRoomModel,
        floor: floorModel,
        job: jobModel,
        user: userModel,
        transactions: TransactionsModel,
      } = global.mongoModel;
      let { sortBy, size, page, keyword } = req.query;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "images",
            localField: "file",
            foreignField: "_id",
            as: "images",
          },
        },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];

      if (sortBy && sortType) {
        switch (sortBy) {
          case "createdAt": {
            sort = { createdAt: sortType };
            break;
          }
          case "updatedAt": {
            sort = { updatedAt: sortType };
            break;
          }
          default:
            sort = { createdAt: -1 };
        }
        condition.push({ $sort: sort });
      }

      const resData = await TransactionsModel.paginate(size, page, condition);

      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "Không có danh sách");
      }

      for (let i = 0; i < resData.data.length; i++) {
        if (resData.data[i].images.length > 0) {
          resData.data[i].images = helpers.getImageUrl(
            resData.data[i].images,
            true
          );
        }
      }

      const myArray = [];
      // get thông tin khách đang thuê
      const userID = req["userProfile"] || "";
      const motelRoomData = await motelRoomModel
        .find({ owner: userID })
        .populate("floors")
        .lean()
        .exec();
      if (motelRoomData) {
        for (let i = 0; i < motelRoomData.length; i++) {
          for (let j = 0; j < motelRoomData[i].floors.length; j++) {
            for (let k = 0; k < motelRoomData[i].floors[j].rooms.length; k++) {
              const roomData = await roomModel
                .find({ _id: motelRoomData[i].floors[j].rooms[k] })
                .lean()
                .exec();
              if (roomData) {
                const DataJob = await jobModel
                  .findOne({ room: roomData })
                  .lean()
                  .exec();
                if (DataJob) {
                  if (!myArray.includes(DataJob.user.toString())) {
                    myArray.push(DataJob.user.toString());
                  }
                }
              }
            }
          }
        }
      }
      if (myArray.length <= 0) {
        if (!resData) {
          return HttpResponse.returnBadRequestResponse(
            res,
            "Không có danh sách"
          );
        }
      }
      const dataRes = [];
      for (let p = 0; p < myArray.length; p++) {
        const userId = myArray[p];
        console.log("userId", userId);
        for (let l = 0; l < resData.data.length; l++) {
          const userIdResData = resData.data[l].user._id;
          if (userId.toString() == userIdResData.toString()) {
            dataRes.push(resData.data[l]);
          }
        }
      }

      return HttpResponse.returnSuccessResponse(res, dataRes);
    } catch (e) {
      next(e);
    }
  }

  static async postAddBank(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { banking: BankingModel, image: imageModel } = global.mongoModel;
      const { user: userModel } = global.mongoModel;

      const id = req.params.id;

      const imageService = new ImageService("local", true);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }

      const { body: data } = req;
      const pathImg = data.urlImgCloud;

      if (pathImg == "") {
        const dataIMG_font = await imageModel.findOne({
          path: data.images[0],
        });
        const dataIMG = [];
        dataIMG.push(dataIMG_font);
        data.images = dataIMG;
      } else {
        let imageData = null;
        imageData = await imageModel.create({
          type: "local",
          pathImg,
          path: pathImg,
        });
        if (!imageData) {
          return HttpResponse.returnInternalServerResponseWithMessage(
            res,
            imageData.message
          );
        }
        const dataIMG_font = await imageModel.findOne({ path: pathImg });
        const dataIMG = [];
        dataIMG.push(dataIMG_font);
        data.images = dataIMG;
      }

      if (id === "add") {
        const addBank = await BankingModel.create({
          user: req["userId"],
          id: data.id,
          bank: data.bank,
          branch: data.branch,
          nameTk: data.nameTk,
          stk: data.stk,
          images: data.images,
          nameTkLable: data.nameTkLable,
        });
        return HttpResponse.returnSuccessResponse(res, addBank);
      } else {
        const edit = await BankingModel.findOneAndUpdate({ _id: id }, data, {
          new: true,
        });
        return HttpResponse.returnSuccessResponse(res, edit);
      }
    } catch (e) {
      next(e);
    }
  }

  static async getBank(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const { banking: BankingModel, image: imageModel } = global.mongoModel;
      let { sortBy, size, page, keyword } = req.query;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "images",
            localField: "images",
            foreignField: "_id",
            as: "images",
          },
        },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];

      if (sortBy && sortType) {
        switch (sortBy) {
          case "createdAt": {
            sort = { createdAt: sortType };
            break;
          }
          case "updatedAt": {
            sort = { updatedAt: sortType };
            break;
          }
          default:
            sort = { createdAt: -1 };
        }
        condition.push({ $sort: sort });
      }

      const resData = await BankingModel.paginate(size, page, condition);

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  static async getBankDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const { banking: BankingModel, image: imageModel } = global.mongoModel;
      const id = req.params.id;

      let resData = await BankingModel.findOne({ _id: id })
        .populate("images")
        .lean()
        .exec();
      if (!resData) {
        return HttpResponse.returnErrorWithMessage("BankName không tồn tại");
      }

      // resData.imgView = "";
      // if (resData.images && resData.images.length > 0) {
      //   // resData.images = helpers.getImageUrl(resData.images, true);
      //   resData.imgView = resData.images[0].path;
      // }

      // resData = helpers.changeTimeZone(resData);

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  static async getBankName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const { banking: BankingModel, image: imageModel } = global.mongoModel;

      return HttpResponse.returnSuccessResponse(res, options);
    } catch (e) {
      next(e);
    }
  }

  static async deleteBankName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const { banking: BankingModel, image: imageModel } = global.mongoModel;

      const id = req.params.id;

      // Get user data
      const Data = await BankingModel.findOne({ _id: id })
        .lean()
        .exec();

      if (!Data) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tài khoản BankName không tồn tại"
        );
      }

      // Remove all user choosen
      await BankingModel.remove({ _id: id }).exec();

      return HttpResponse.returnSuccessResponse(res, null);
    } catch (e) {
      next(e);
    }
  }

  static async getBankNameUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const { banking: BankingModel, image: imageModel } = global.mongoModel;
      let { sortBy, size, page, keyword } = req.query;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "images",
            localField: "images",
            foreignField: "_id",
            as: "images",
          },
        },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];

      if (sortBy && sortType) {
        switch (sortBy) {
          case "createdAt": {
            sort = { createdAt: sortType };
            break;
          }
          case "updatedAt": {
            sort = { updatedAt: sortType };
            break;
          }
          default:
            sort = { createdAt: -1 };
        }
        condition.push({ $sort: sort });
      }

      const resData = await BankingModel.paginate(size, page, condition);

      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Không có danh sách ngân hàng không tồn tại"
        );
      }
      const data = resData.data;
      const resDataOptions = [];

      for (let k = 0; k < data.length; k++) {
        const item = data[k].bank;
        const branch = data[k].branch;
        const stk = data[k].stk;
        const nameTk = data[k].nameTk;
        const images = data[k].images[0].path;
        options.map((x) => {
          if (x.value == item) {
            const temp = { ...x, branch, stk, nameTk, images };
            resDataOptions.push(temp);
          }
        });
      }

      return HttpResponse.returnSuccessResponse(res, resDataOptions);
    } catch (e) {
      next(e);
    }
  }

  static async getTransactionUserPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const { transactions: TransactionsModel } = global.mongoModel;
      const { image: imageModel } = global.mongoModel;
      let { sortBy, size, page, keyword } = req.query;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];

      if (sortBy && sortType) {
        switch (sortBy) {
          case "createdAt": {
            sort = { createdAt: sortType };
            break;
          }
          case "updatedAt": {
            sort = { updatedAt: sortType };
            break;
          }
          default:
            sort = { createdAt: -1 };
        }
        condition.push({ $sort: sort });
      }

      const resData = await TransactionsModel.paginate(size, page, condition);
      const data = [];

      if (resData) {
        for (let i = 0; i < resData.data.length; i++) {
          const _id = resData.data[i].user._id;
          const id = req["userId"];
          if (_id.toString() == id.toString()) {
            // get file Url

            if (resData.data[i].file) {
              const dataimg = await imageModel.findOne({
                _id: resData.data[i].file,
              });
              if (dataimg) {
                resData.data[i].file = await helpers.getImageUrl(dataimg);
              }
            }
            data.push(resData.data[i]);
          }
        }
      }
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "logPayment");
      }

      console.log({data})

      return HttpResponse.returnSuccessResponse(res, data);
    } catch (e) {
      next(e);
    }
  }

  static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init  models
      const { user: userModel, code: codeModel } = global.mongoModel;

      const imageService = new ImageService("local", true);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }
      const id = req.params.id;
      const keyRandom = parseInt(rn(optionsNumbeer));
      const passwordNew = "homelands@" + keyRandom;

      const salt = await bcrypt.genSaltSync(parseInt(global.env.hashSalt));
      const passwordnewHash = bcrypt.hashSync(passwordNew, salt);

      // get user data
      let resData = await userModel
        .findOne(
          { _id: id, isDeleted: false },
          { token: 0, password: 0, social: 0 }
        )
        .lean()
        .exec();
      // If user was deleted
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tài khoản không tồn tại"
        );
      }
      // Update the new one
      // Update token to user data
      await userModel.update({ _id: id }, { password: passwordnewHash });

      const html = `Hi ${resData.lastName},
        <br/>
        Cảm ơn bạn , Đây Là Mật Khâu Mới Tài Khoản!
        <br/>
        Mật Khâu Mới: <b>${passwordNew}</b>
        <br/>
        `;

      await sendMail.sendMail(
        process.env.Gmail_USER,
        resData.email,
        "Mật Khâu Mới",
        html
      );

      return HttpResponse.returnSuccessResponse(res, passwordNew);
    } catch (e) {
      // Pass error to the next middleware
      next(e);
    }
  }

  //note
  static async getBankMasterName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      // const id = req.params
      const { user: userModel, code: codeModel } = global.mongoModel;
      const { banking: BankingModel, image: imageModel } = global.mongoModel;

      const adminUser = await userModel.findOne({ role: { $in: ['master'] } });

      if (adminUser) {
        // Use the admin user's ID to find banking information
        const bankMasterOptions = await BankingModel.find({ user: adminUser._id });

        return HttpResponse.returnSuccessResponse(res, bankMasterOptions);
      } else {
        // Handle the case where no admin user is found
        return HttpResponse.returnNotFoundResponse(res, 'No admin user found');
      }
      // return HttpResponse.returnSuccessResponse(res, bankMasterOptions);
    } catch (e) {
      next(e);
    }
  }

  static async getBankOwnerRoom(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const id = req.params.id;
      // Init user model`
      // const id = req.params
      const { 
        user: userModel, 
        code: codeModel, 
        banking: BankingModel, 
        image: imageModel,
        floor: floorModel,
        motelRoom: motelRoomModel
      } = global.mongoModel;

      const floorData = await floorModel.findOne({rooms: id}).lean().exec();

      const motelData = await motelRoomModel.findOne({floors: floorData._id}).lean().exec();

      const userData = await userModel.findOne({_id: motelData.owner});

      console.log({userData});


        // Use the admin user's ID to find banking information
      const bankMasterOptions = await BankingModel.find({ user: userData._id });

      return HttpResponse.returnSuccessResponse(res, bankMasterOptions);
    } catch (e) {
      next(e);
    }
  }
  //----------------
}
