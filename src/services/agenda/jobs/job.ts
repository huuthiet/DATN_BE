import * as moment from "moment";
import * as lodash from "lodash";

var nodemailer = require('nodemailer');

import JobController from "../../../controllers/homeKey/job.controller";
import EnergyController from "../../../controllers/homeKey/energy.controller";
import NotificationController from "../../../controllers/homeKey/notification";
import electric from "./electric";

export default (agenda) => {
  // create order
  // Cần phải sửa: để check lại hạn hợp đồng là trong tháng hay qua tháng tiếp theo
  agenda.define("CreateOrder", async (job, done) => {
    try {
      console.log("CreateOrder");
      // Init models
      const { order: orderModel, job: jobModel } = global.mongoModel;

      let data = job.attrs.data;

      let resData = await JobController.getJob(job.attrs.data.jobId);

      if (resData.isActived) {
        await NotificationController.createNotification({
          title: "Thông báo đóng tiền phòng",
          content: "Vui lòng thanh toán tiền phòng trong vòng 5 ngày.",
          user: resData.user,
        });

        const orderData = await orderModel.create({
          user: resData.user,
          job: resData._id,
          isCompleted: false,
          description: `Tiền phòng tháng ${moment().month() + 1}/${moment().year()}`,
          amount: resData.room.price,
          type: "monthly",
        });

        resData = await jobModel.findOneAndUpdate(
          { _id: resData._id },
          {
            $addToSet: { orders: orderData._id },
            currentOrder: orderData._id,
            status: "pendingMonthlyPayment",
          },
          { new: true }
        );

        await global.agendaInstance.agenda.schedule(
          moment()
            .endOf("month")
            .toDate(),
          "CheckOrderStatus",
          { orderId: orderData._id }
        );
        await global.agendaInstance.agenda.schedule(
          moment()
            .startOf("month")
            .add(1, "months")
            .toDate(),
          "CreateOrder",
          { jobId: resData._id }
        );
      } else {
        // -----------------new
        //Xóa job tạm thời
        // await jobModel.findOneAndUpdate({ _id: resData._id }, {isDeleted: true})
        //                           .lean()
        //                           .exec();
        //---------------------
      }
      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("CreateOrderForNextMonth", async (job, done) => {
    try {
      console.log("CreateOrderForNextMonth");
      // Init models
      const { order: orderModel, job: jobModel, room: roomModel } = global.mongoModel;

      let data = job.attrs.data;

      let resData = await JobController.getJobNoImg(job.attrs.data.jobId);

      const timeCal = moment().subtract(1, "months"); 
      const startTime : moment.Moment = moment().subtract(1, 'months').startOf("months");
      const start = startTime.format("YYYY-MM-DD"); // đầu tháng trước
      const endTime: moment.Moment = moment().subtract(1, 'months').endOf("months");// cuối tháng trước
      const end = endTime.format("YYYY-MM-DD");// cuối tháng trước

      const expireTime = endTime.add(15, "days"); // note: để tạm 15 ngày, cần tính lại tất cả, cần set lại cuối ngày

      let electricNumber = await EnergyController.countElectricV2(job.attrs.data.jobId, start, end);
      console.log({electricNumber});

      if (electricNumber === null) {
        electricNumber = 0;
      }

      const roomId = resData.room;
      const roomData = await roomModel.findOne({_id: roomId})
                                                                  .lean()
                                                                  .exec();

      const electricityPricePerKwh = roomData.electricityPrice;

      const electricPrice = electricNumber * electricityPricePerKwh;

      const numberDayStay = moment(start).daysInMonth();
      const waterPrice = (roomData.waterPrice * roomData.person);
      const servicePrice = roomData.garbagePrice;
      const vehiclePrice = roomData.wifiPrice * roomData.vihicle;
      const roomPrice = resData.room.price;
      const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;



      if (resData) {
        if (resData.isActived && !(resData.isDeleted)) {
          const orderData = await orderModel.create({
            user: resData.user,
            job: resData._id,
            isCompleted: false,
            numberDayStay: numberDayStay,
            electricNumber: electricNumber,
            electricPrice: electricPrice,
            waterPrice: waterPrice,
            servicePrice: servicePrice,
            vehiclePrice: vehiclePrice,
            roomPrice: roomPrice,
            description: `Tiền phòng tháng ${ timeCal.month() + 1}/${ timeCal.year()}`, //đang ở đầu tháng để tạo order cho tháng trước
            amount: amount,
            type: "monthly",
            startTime: startTime.toDate(),
            endTime: endTime.toDate(),
            expireTime: expireTime.toDate(),
          });

          resData = await jobModel.findOneAndUpdate(
            { _id: resData._id },
            {
              $addToSet: { orders: orderData._id },
              currentOrder: orderData._id,
              status: "pendingMonthlyPayment",
            },
            { new: true }
          );

          await global.agendaInstance.agenda.schedule(
            moment().add("2", 'minutes').toDate(), //note: gốc là 5 minutes
            "CheckOrderStatusTemp",
            { orderId: orderData._id }
          );

          // await global.agendaInstance.agenda.schedule(
          //   moment()
          //     .endOf("month")
          //     .toDate(),
          //   "CheckOrderStatus",
          //   { orderId: orderData._id }
          // );
          // await global.agendaInstance.agenda.schedule(
          //   moment()
          //     .startOf("month")
          //     .add(1, "months")
          //     .toDate(),
          //   "CreateOrder",
          //   { jobId: resData._id }
          // );
        } else {
          // -----------------new
          //Xóa job tạm thời
          // await jobModel.findOneAndUpdate({ _id: resData._id }, {isDeleted: true})
          //                           .lean()
          //                           .exec();
          //---------------------
        }
      }
      done();
    } catch (err) {
      done();
    }
  });

  // create first month order
  agenda.define("CreateFirstMonthOrder", async (job, done) => {
    try {

      console.log("CreateFirstMonthOrder");
      // Init models
      const { order: orderModel, job: jobModel, room: roomModel } = global.mongoModel;

      let data = job.attrs.data;

      let resData = await JobController.getJobNoImg(job.attrs.data.jobId);

      if (resData) {
        if (resData.isActived && !(resData.isDeleted)) {
          const checkInTime = resData.checkInTime;
          const startTime = moment(checkInTime).startOf("day");
          const start = startTime.format("YYYY-MM-DD");
          const endTime = moment(checkInTime).endOf("month").endOf("day");
          const end = endTime.format("YYYY-MM-DD");

          const expireTime = endTime.add(15, "days");
  
          let electricNumber = await EnergyController.countElectricV2(job.attrs.data.jobId, start, end);
          console.log({electricNumber});

          if (electricNumber === null) {
            electricNumber = 0;
          }
  
          const roomId = resData.room;
          const roomData = await roomModel.findOne({_id: roomId})
                                                                      .lean()
                                                                      .exec();
          const electricityPricePerKwh = roomData.electricityPrice;
  
          const electricPrice = electricNumber * electricityPricePerKwh;
          const dayOfMon = moment(checkInTime).daysInMonth(); // số ngày của tháng
          const numberDayStay = (moment(resData.checkInTime).endOf("month").diff(moment(resData.checkInTime), "days") + 1); //cộng 1: tính cả ngày checkIn
          const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
          const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
          const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
          const roomPrice = (resData.room.price / dayOfMon) * numberDayStay;
          const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;
          
          const orderData = await orderModel.create({
            user: resData.user,
            job: resData._id,
            isCompleted: false,
            electricNumber: electricNumber,
            electricPrice: electricPrice,
            numberDayStay: numberDayStay,
            waterPrice: waterPrice,
            servicePrice: servicePrice,
            vehiclePrice: vehiclePrice,
            roomPrice: roomPrice,
            description: `Tiền phòng tháng ${moment(checkInTime).month() + 1}/${moment(checkInTime).year()}`, 
            amount: amount,
            type: "monthly",
            startTime: startTime.toDate(),
            endTime: endTime.toDate(),
            expireTime: expireTime.toDate(),
          });
  
          resData = await jobModel.findOneAndUpdate(
            { _id: resData._id },
            {
              $addToSet: { orders: orderData._id },
              currentOrder: orderData._id,
              status: "pendingMonthlyPayment",
            },
            { new: true }
          );
  
          await global.agendaInstance.agenda.schedule(
            moment().add("5", 'hours').toDate(), //note: 5 minute
            "CheckOrderStatusTemp",
            { orderId: orderData._id }
          );
        }
      }

      
      // await global.agendaInstance.agenda.schedule(
      //   moment()
      //     .startOf("month")
      //     .add("1", "months")
      //     .toDate(),
      //   "CheckOrderStatusTemp",
      //   { orderId: orderData._id }
      // );

      // await global.agendaInstance.agenda.schedule(
      //   moment()
      //     .endOf("month")
      //     .toDate(),
      //   "CheckOrderStatus",
      //   { orderId: orderData._id }
      // );

      // await global.agendaInstance.agenda.every("2 minutes", "CreateOrder", { jobId: resData._id });
      // await global.agendaInstance.agenda.schedule(
      //   moment()
      //     .startOf("month")
      //     .add(1, "months")
      //     .toDate(),
      //   "CreateOrder",
      //   { jobId: resData._id }
      // );
      // }
      done();
    } catch (err) {
      done();
    }
  });

  // check order status
  agenda.define("CheckOrderStatus", async (job, done) => {
    try {
      // Init models
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, 
        payDepositList: payDepositListModel,
      } = global.mongoModel;

      let data = job.attrs.data;

      let orderData = await orderModel.findOne(job.attrs.data.orderId);

      if (orderData) {
        if (!orderData.isCompleted) {
          // await NotificationController.createNotification({
          //   title: "Thông báo hết hạn đóng tiền phòng",
          //   content: "Vui lòng liên hệ nhân viên để được hỗ trợ.",
          //   user: orderData.user,
          // });

          const jobData = await jobModel.findOne({ orders: orderData._id })
            .lean()
            .exec();

          const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
            { orders: orderData._id },
            {
              isActivated: false,
              isDeleted: true,
            },
            { new: true }
          );

          await payDepositListModel.create({
            room: jobDataAfterUpdate.room,
            user: jobDataAfterUpdate.user,
            job: jobDataAfterUpdate._id,
            ordersNoPay: orderData._id,
            type: "noPayDeposit",
            reasonNoPay: "noPayAterCheckInCost",
            amount: jobDataAfterUpdate.deposit,
            //thêm hạn thanh toán: note
          });

          if (jobData) {
            let roomId = jobData.room;
            const roomInfor = await roomModel.findOne({ _id: roomId })
              .lean()
              .exec();

            const userId = roomInfor.rentedBy;

            await roomModel.findOneAndUpdate({ _id: roomId }, {
              status: "available",
              $unset: { rentedBy: 1 },
            })
              .exec()

            //cập nhật lại floor
            let floorData = await floorModel
              .findOne({ rooms: roomId })
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
                  soonExpireContractRoom: roomGroup["soonExpireContract"]
                    ? roomGroup["soonExpireContract"].length
                    : 0,
                  rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                  depositedRoom: roomGroup["deposited"]
                    ? roomGroup["deposited"].length
                    : 0,
                }
              )
              .exec();

            //cập nhật lại motel

            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();

            let updateData = {
              availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
              rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
              depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
              soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
            };

            await motelRoomModel
              .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
              .exec();


            //Xóa job khỏi user
            let userUpdateData = {
              $pull: {
                jobs: jobData._id,
              },
            };

            await userModel
              .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
              .exec();
          }
        }
      }

      done();
    } catch (err) {
      done();
    }
  });

  // check job status
  agenda.define("CheckJobStatus", async (job, done) => {
    try {
      // Init models
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel,
        payDepositList: payDepositListModel
      } = global.mongoModel;

      let data = job.attrs.data;

      let jobData = await jobModel.findOne(job.attrs.data.jobId);


      if (jobData) {
        let roomId = jobData.room;

        if (!jobData.isActived && !jobData.isDeleted) {
          // await NotificationController.createNotification({
          //   title: "Thông báo hết hạn kích hoạt",
          //   content: "Bạn đã quá hạn nhận phòng. Hệ thống tự hủy đặt phòng.",
          //   user: jobData.user,
          // });

          const jobDataAfterUpdate = await jobModel
            .findOneAndUpdate(
              { _id: jobData._id },
              {
                status: "expiredActivated",
                isDeleted: true,
              }, 
              {new: true}
            )
            .exec();

          await payDepositListModel.create({
            room: jobDataAfterUpdate.room,
            user: jobDataAfterUpdate.user,
            job: jobDataAfterUpdate._id,
            type: "noPayDeposit",
            reasonNoPay: "noActive",
            amount: jobDataAfterUpdate.deposit,
          });

          const roomInfor = await roomModel.findOne({ _id: roomId })
            .lean()
            .exec();

          const userId = roomInfor.rentedBy;

          await roomModel.findOneAndUpdate({ _id: roomId }, {
            status: "available",
            $unset: { rentedBy: 1 },
          })
            .exec()

          //cập nhật lại floor
          let floorData = await floorModel
            .findOne({ rooms: roomId })
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
                soonExpireContractRoom: roomGroup["soonExpireContract"]
                  ? roomGroup["soonExpireContract"].length
                  : 0,
                rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                depositedRoom: roomGroup["deposited"]
                  ? roomGroup["deposited"].length
                  : 0,
              }
            )
            .exec();

          //cập nhật lại motel

          let motelRoomData = await motelRoomModel
            .findOne({ floors: floorData._id })
            .populate("floors")
            .lean()
            .exec();

          let updateData = {
            availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
            rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
            depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
            soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
          };

          await motelRoomModel
            .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
            .exec();

          //Xóa job khỏi user
          let userUpdateData = {
            $pull: {
              jobs: jobData._id,
            },
          };

          await userModel
            .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
            .exec();
        }
      }

      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("CheckOrderStatusTemp", async (job, done) => {
    try {
      // Init models
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, } = global.mongoModel;

      let data = job.attrs.data;

      const jobData = await jobModel.findOne({ orders: job.attrs.data.orderId });

      if (jobData) {
        let checkInTime = jobData.checkInTime;
        // checkInTime.setMonth(checkInTime.getMonth() + jobData.rentalPeriod); //
        
        let checkOutTime = moment(jobData.checkInTime).add(jobData.rentalPeriod, "months").subtract("1", "days"); // chính xác ngày cuối cùng còn được ở
        //nên có thể ngày hết hạn ở có thể nhỏ hơn ngày mà task này được chạy (vì task này chạy vào đầu tháng, một số phòng đặt phòng vào đầu tháng thì
        // vào cuối tháng trước, trước khi task chạy thì đã hết hạn rồi)

        if (moment().year() < checkOutTime.year()) {
          //Nhắc nhở đóng tiền liên tục 15 ngày đầu
          await global.agendaInstance.agenda.schedule(
            moment().add("2", 'minutes').toDate(), //note: 5
            "RemindUserMonthly15EveryDay_ExpireNextMonth",//done
            { orderId: job.attrs.data.orderId }
          );

        } else if (moment().year() === checkOutTime.year()) {
          if (moment().month() < checkOutTime.month()) {

            //Nhắc nhở đóng tiền liên tục 15 ngày đầu
            await global.agendaInstance.agenda.schedule(
              moment().add("2", 'minutes').toDate(), //note: 5
              "RemindUserMonthly15EveryDay_ExpireNextMonth",//done
              { orderId: job.attrs.data.orderId }
            );

          } else if (moment().month() === checkOutTime.month()) {
            if (checkOutTime.date() <= 2) {
              await global.agendaInstance.agenda.schedule(
                moment().add("2", 'minutes').toDate(), //note: 5
                "RemindUserMonthlyToExpirePlus2Day_Expire1Or2ThisMonth", 
                { orderId: job.attrs.data.orderId }
              );
            } else if (checkOutTime.date() <= 15) {
              await global.agendaInstance.agenda.schedule(
                moment().add("2", 'minutes').toDate(), //note: 5
                "RemindUserMonthlyToExpireDay_ExpireThisMonth", //done
                { orderId: job.attrs.data.orderId }
              );

            } else {
              await global.agendaInstance.agenda.schedule(
                moment().add("2", 'minutes').toDate(),//note: 5
                "RemindUserMonthlyToDay15_ExpireThisMonth", //done
                { orderId: job.attrs.data.orderId }
              );
            }
          } else {
            //check in vào đầu tháng, sẽ hết hạn vào ngày cuối cùng của tháng
            await global.agendaInstance.agenda.schedule(
              moment().add("2", 'minutes').toDate(),//note: 5
              "RemindUserMonthlyToDay3_ExpireEndOfLastMonth",
              { orderId: job.attrs.data.orderId }
            );
          }
        } else {
          //check in vào đầu tháng, sẽ hết hạn vào ngày cuối cùng của tháng
          await global.agendaInstance.agenda.schedule(
            moment().add("2", 'minutes').toDate(),//note: 5
            "RemindUserMonthlyToDay3_ExpireEndOfLastMonth",
            { orderId: job.attrs.data.orderId }
          );
        }
      }
      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("RemindUserMonthlyToDay3_ExpireEndOfLastMonth", async(job, done) => {
    try {
      const orderId = job.attrs.data.orderId;
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, 
        payDepositList: payDepositListModel,
      } = global.mongoModel;

      

      const orderData = await orderModel.findOne({ _id: job.attrs.data.orderId })
                                                                  .lean()
                                                                  .exec();

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;

        const jobData = await JobController.getJobNoImg(jobId);

        const checkInTime = jobData.checkInTime;
        const rentalPeriod = jobData.rentalPeriod;

        const checkOutTime = moment(checkInTime).add(rentalPeriod, "months").subtract(1, "days"); // ngày cuối cùng được ở

        if (orderData.isCompleted === false) {

          const userData = await userModel.findOne({ _id: userId })
                                                                  .lean()
                                                                  .exec();

          if (moment().date() <= 3) {
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
  
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${checkOutTime.month() + 1}/${checkOutTime.year()}`,
                  text: `Quý khách vui lòng đóng tiền phòng tháng${checkOutTime.month() + 1}/${checkOutTime.year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày 03/${moment().month() + 1}/${moment().year()}. Lưu ý: Nếu không hoàn thành thanh toán, quý khách sẽ không được hoàn trả tiền cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }

            await global.agendaInstance.agenda.schedule(
              moment()
                .add(1, "days")
                .toDate(),
              "RemindUserMonthlyToDay3_ExpireEndOfLastMonth",
              { orderId: job.attrs.data.orderId }
            );
          } else {
            const jobDataAfterUpdate= await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );

            await payDepositListModel.create({
              room: jobDataAfterUpdate.room,
              user: jobDataAfterUpdate.user,
              job: jobDataAfterUpdate._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobDataAfterUpdate.deposit + jobDataAfterUpdate.afterCheckInCost,
              //thêm hạn thanh toán: note
            });

            if (jobData) {
              let roomId = jobData.room;
              const roomInfor = await roomModel.findOne({ _id: roomId })
                .lean()
                .exec();

              const userId = roomInfor.rentedBy;

              await roomModel.findOneAndUpdate({ _id: roomId }, {
                status: "available",
                $unset: { rentedBy: 1 },
              })
                .exec()

              //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: roomId })
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
                    soonExpireContractRoom: roomGroup["soonExpireContract"]
                      ? roomGroup["soonExpireContract"].length
                      : 0,
                    rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                    depositedRoom: roomGroup["deposited"]
                      ? roomGroup["deposited"].length
                      : 0,
                  }
                )
                .exec();

              //cập nhật lại motel

              let motelRoomData = await motelRoomModel
                .findOne({ floors: floorData._id })
                .populate("floors")
                .lean()
                .exec();

              let updateData = {
                availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
                rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
                depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
                soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
              };

              await motelRoomModel
                .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
                .exec();


              //Xóa job khỏi user
              let userUpdateData = {
                $pull: {
                  jobs: jobData._id,
                },
              };

              await userModel
                .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
                .exec();

            }
          }
        } else {
          const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
            { orders: orderData._id },
            {
              isActivated: false,
              isDeleted: true,
            },
            { new: true }
          );

          await payDepositListModel.create({
            room: jobDataAfterUpdate.room,
            user: jobDataAfterUpdate.user,
            job: jobDataAfterUpdate._id,
            type: "payDeposit",
            reasonNoPay: "unknown",
            amount: jobDataAfterUpdate.deposit + jobDataAfterUpdate.afterCheckInCost,
            //thêm hạn thanh toán: note
          });

          //new

          if (jobData) {
            let roomId = jobData.room;
            const roomInfor = await roomModel.findOne({ _id: roomId })
              .lean()
              .exec();

            const userId = roomInfor.rentedBy;

            await roomModel.findOneAndUpdate({ _id: roomId }, {
              status: "available",
              $unset: { rentedBy: 1 },
            })
              .exec()

            //cập nhật lại floor
            let floorData = await floorModel
              .findOne({ rooms: roomId })
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
                  soonExpireContractRoom: roomGroup["soonExpireContract"]
                    ? roomGroup["soonExpireContract"].length
                    : 0,
                  rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                  depositedRoom: roomGroup["deposited"]
                    ? roomGroup["deposited"].length
                    : 0,
                }
              )
              .exec();

            //cập nhật lại motel

            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();

            let updateData = {
              availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
              rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
              depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
              soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
            };

            await motelRoomModel
              .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
              .exec();


            //Xóa job khỏi user
            let userUpdateData = {
              $pull: {
                jobs: jobData._id,
              },
            };

            await userModel
              .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
              .exec();
          }
        }
      }
      done();
    } catch (error) {
      console.log({error});
      done();
    }
  });

  agenda.define("RemindUserMonthlyToExpirePlus2Day_Expire1Or2ThisMonth", async(job, done) => {
    try {
      const orderId = job.attrs.data.orderId;
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel,
        payDepositList: payDepositListModel,
      } = global.mongoModel;

      

      const orderData = await orderModel.findOne({ _id: job.attrs.data.orderId })
                                                                  .lean()
                                                                  .exec();

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;

        const jobData = await JobController.getJobNoImg(jobId);

        const checkInTime = jobData.checkInTime;
        const rentalPeriod = jobData.rentalPeriod;

        const checkOutTime = moment(checkInTime).add(rentalPeriod, "months").subtract(1, "days"); // ngày cuối cùng được ở
     

        if (orderData.isCompleted === false) {

          const userData = await userModel.findOne({ _id: userId })
                                                                  .lean()
                                                                  .exec();

          if (moment().date() <= 4) {
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
  
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${checkOutTime.month()}/${checkOutTime.year()}`,//tháng trước
                  text: `Quý khách vui lòng đóng tiền phòng tháng${checkOutTime.month()}/${checkOutTime.year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày 04/${checkOutTime.month() + 1}/${checkOutTime.year()}. Lưu ý: Nếu không hoàn thành thanh toán, quý khách sẽ không được hoàn trả tiền cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }
            await global.agendaInstance.agenda.schedule(
              moment()
                .add(1, "days")
                .toDate(),
              "RemindUserMonthlyToExpirePlus2Day_Expire1Or2ThisMonth",
              { orderId: job.attrs.data.orderId }
            );
          } else {
            const payDeposit = await payDepositListModel.create({
              room: jobData.room,
              user: jobData.user,
              job: jobData._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobData.deposit + jobData.afterCheckInCost,
              //thêm hạn thanh toán: note
            });
            const startTime = moment().startOf("months").startOf("day");
            const start = startTime.format("YYYY-MM-DD");
            const monInEnd = (moment().month() + 1) < 10 ? ("0" + (moment().month() + 1)) : (moment().month() + 1);
            // const end = moment().year() + "-" + monInEnd + "-" + "04";
            const endTime = checkOutTime.endOf("day");
            const end = endTime.format("YYYY-MM-DD");
            const expireTime = endTime.add(15, "days");

            let electricNumber = await EnergyController.countElectricV2(jobData._id, start, end);

            if (electricNumber === null) {
              electricNumber = 0;
            }

            const roomId = jobData.room;
            const roomData = await roomModel.findOne({_id: roomId})
                                                                        .lean()
                                                                        .exec();
            const electricityPricePerKwh = roomData.electricityPrice;
            const electricPrice = electricNumber * electricityPricePerKwh;

            const dayOfMon = moment().daysInMonth(); // số ngày của tháng
            const numberDayStay = (Math.abs(checkOutTime.diff(checkOutTime.startOf("month"), "days")) + 1); //cộng 1: tính cả ngày checkIn
            const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
            const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
            const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
            const roomPrice = (jobData.room.price / dayOfMon) * numberDayStay;
            const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;

            //oder  những ngày của tháng mới
            const orderDataNoPay = await orderModel.create({
              user: jobData.user,
              job: jobData._id,
              isCompleted: false,
              electricNumber: electricNumber,
              electricPrice: electricPrice,
              numberDayStay: numberDayStay,
              waterPrice: waterPrice,
              servicePrice: servicePrice,
              vehiclePrice: vehiclePrice,
              roomPrice: roomPrice,
              description: `Tiền phòng tháng ${moment().month() + 1}/${moment().year()}`,
              amount: amount,
              type: "monthly",
              startTime: startTime.toDate(),
              endTime: endTime.toDate(),
              expireTime: expireTime.toDate(),
            });

            const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                $addToSet: { orders: orderDataNoPay._id },
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );

            //Thêm order chưa được trả
            await payDepositListModel.findOneAndUpdate(
              {_id : payDeposit._id},
              {
                $addToSet: { ordersNoPay: orderDataNoPay._id },
              },
              { new: true }
            )

            if (jobData) {
              let roomId = jobData.room;
              const roomInfor = await roomModel.findOne({ _id: roomId })
                .lean()
                .exec();

              const userId = roomInfor.rentedBy;

              await roomModel.findOneAndUpdate({ _id: roomId }, {
                status: "available",
                $unset: { rentedBy: 1 },
              })
                .exec()

              //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: roomId })
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
                    soonExpireContractRoom: roomGroup["soonExpireContract"]
                      ? roomGroup["soonExpireContract"].length
                      : 0,
                    rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                    depositedRoom: roomGroup["deposited"]
                      ? roomGroup["deposited"].length
                      : 0,
                  }
                )
                .exec();

              //cập nhật lại motel

              let motelRoomData = await motelRoomModel
                .findOne({ floors: floorData._id })
                .populate("floors")
                .lean()
                .exec();

              let updateData = {
                availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
                rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
                depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
                soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
              };

              await motelRoomModel
                .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
                .exec();


              //Xóa job khỏi user
              let userUpdateData = {
                $pull: {
                  jobs: jobData._id,
                },
              };

              await userModel
                .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
                .exec();

            }
          }
        } else {
          //NOTE: thêm job thanh toán những ngày còn lại
          if (moment().date() <= checkOutTime.date()) {
            await global.agendaInstance.agenda.schedule(
              checkOutTime
                .add(1, "days")
                .toDate(),
              "CreateOrderForRestDayInMonExpireContract_At1Or2Day",
              { jobId: jobData._id }
            );
          } else {
            await global.agendaInstance.agenda.schedule(
              moment()
                .add(2, "hours")
                .toDate(),
              "CreateOrderForRestDayInMonExpireContract_At1Or2Day",
              { jobId: jobData._id }
            );
          }
        }
      }
    } catch (error) {
      console.log({error});
      done();
    }
  })

  agenda.define("CreateOrderForRestDayInMonExpireContract_At1Or2Day", async (job, done) => {
    try {
      console.log("CreateOrderForRestDayInMonExpireContract_At1Or2Day");
      // Init models
      const { order: orderModel, job: jobModel, room: roomModel } = global.mongoModel;

      let data = job.attrs.data;

      let resData = await JobController.getJobNoImg(job.attrs.data.jobId);

      if (resData) {
        if (resData.isActived && !(resData.isDeleted)) {
          const checkInDay = resData.checkInTime;
          const rentalPeriod = resData.rentalPeriod;
          const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối 

          const startTime = checkOutDay.startOf("months").startOf("day");
          const start = startTime.format("YYYY-MM-DD");
          const endTime = checkOutDay.endOf("day");
          const end = endTime.format("YYYY-MM-DD");

          const expireTime = endTime.add(15, "days");
          
          let electricNumber = await EnergyController.countElectricV2(job.attrs.data.jobId, start, end);

          if (electricNumber === null) {
            electricNumber = 0;
          }
  
          const roomId = resData.room;
          const roomData = await roomModel.findOne({_id: roomId})
                                                                      .lean()
                                                                      .exec();
          const electricityPricePerKwh = roomData.electricityPrice;
  
          const electricPrice = electricNumber * electricityPricePerKwh;

          const dayOfMon = moment(checkOutDay).daysInMonth(); // số ngày của tháng
          const numberDayStay = (Math.abs(checkOutDay.diff(checkOutDay.startOf("month"), "days")) + 1); //cộng 1: tính cả ngày checkIn
          const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
          const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
          const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
          const roomPrice = (resData.room.price / dayOfMon) * numberDayStay;
          const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;
  
          const orderData = await orderModel.create({
            user: resData.user,
            job: resData._id,
            isCompleted: false,
            electricNumber: electricNumber,
            electricPrice: electricPrice,
            numberDayStay: numberDayStay,
            waterPrice: waterPrice,
            servicePrice: servicePrice,
            vehiclePrice: vehiclePrice,
            roomPrice: roomPrice,
            description: `Tiền phòng tháng ${checkOutDay.month() + 1}/${checkOutDay.year()}`,
            amount: amount,
            type: "monthly",
            startTime: startTime.toDate(),
            endTime: endTime.toDate(),
            expireTime: expireTime.toDate(),
          });
  
          resData = await jobModel.findOneAndUpdate(
            { _id: resData._id },
            {
              $addToSet: { orders: orderData._id },
              currentOrder: orderData._id,
              status: "pendingMonthlyPayment",
            },
            { new: true }
          );
  
          await global.agendaInstance.agenda.schedule(
            moment().add("2", 'minutes').toDate(), //note: 5
            "CheckOrderStatusForContractExpireIn1Or2Day_In2AfterDayExpireContract",
            { orderId: orderData._id }
          );
  
        }       }
      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("CheckOrderStatusForContractExpireIn1Or2Day_In2AfterDayExpireContract", async (job, done) => {
    try {
      // Init models
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, 
        payDepositList: payDepositListModel,
      } = global.mongoModel;

      let data = job.attrs.data;

      let orderData = await orderModel.findOne(job.attrs.data.orderId);

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;
        const jobData = await JobController.getJobNoImg(jobId);
        if (!orderData.isCompleted) {
          const userData = await userModel.findOne({ _id: userId })
            .lean()
            .exec();

          const checkInDay = jobData.checkInTime;
          const rentalPeriod = jobData.rentalPeriod;
          const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối cùng
  
          if (moment().date() <= 6) {
            await global.agendaInstance.agenda.schedule(
              moment()
                .add("1", "days")
                .startOf("days")
                .toDate(),
              "CheckOrderStatusForContractExpireIn1Or2Day_In2AfterDayExpireContract",
              { orderId: orderData._id }
            );

            //gửi lần cuối vào đầu ngày cuối (lấy hiện tại trừ thời gian hết hạn)
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
    
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${checkOutDay.month() + 1}/${checkOutDay.year()}`,
                  text: `Quý khách vui lòng đóng tiền phòng tháng ${checkOutDay.month() + 1}/${checkOutDay.year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày 06/${checkOutDay.month() + 1}/${checkOutDay.year()}. Lưu ý: Nếu không thực hiện đóng hóa đơn này, quý khách sẽ không được hoàn trả tiền cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }
          } else {
            const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );

            await payDepositListModel.create({
              room: jobDataAfterUpdate.room,
              user: jobDataAfterUpdate.user,
              job: jobDataAfterUpdate._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobDataAfterUpdate.deposit + jobDataAfterUpdate.afterCheckInCost,
              //thêm hạn thanh toán: note
            });

            //new

            if (jobData) {
              let roomId = jobData.room;
              const roomInfor = await roomModel.findOne({ _id: roomId })
                .lean()
                .exec();

              const userId = roomInfor.rentedBy;

              await roomModel.findOneAndUpdate({ _id: roomId }, {
                status: "available",
                $unset: { rentedBy: 1 },
              })
                .exec()

              //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: roomId })
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
                    soonExpireContractRoom: roomGroup["soonExpireContract"]
                      ? roomGroup["soonExpireContract"].length
                      : 0,
                    rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                    depositedRoom: roomGroup["deposited"]
                      ? roomGroup["deposited"].length
                      : 0,
                  }
                )
                .exec();

              //cập nhật lại motel

              let motelRoomData = await motelRoomModel
                .findOne({ floors: floorData._id })
                .populate("floors")
                .lean()
                .exec();

              let updateData = {
                availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
                rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
                depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
                soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
              };

              await motelRoomModel
                .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
                .exec();


              //Xóa job khỏi user
              let userUpdateData = {
                $pull: {
                  jobs: jobData._id,
                },
              };

              await userModel
                .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
                .exec();
            }
          }
        } else {
          const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
            { orders: orderData._id },
            {
              isActivated: false,
              isDeleted: true,
            },
            { new: true }
          );

          await payDepositListModel.create({
            room: jobDataAfterUpdate.room,
            user: jobDataAfterUpdate.user,
            job: jobDataAfterUpdate._id,
            type: "payDeposit",
            reasonNoPay: "unknown",
            amount: jobDataAfterUpdate.deposit + jobDataAfterUpdate.afterCheckInCost,
            //thêm hạn thanh toán: note
          });

          //new

          if (jobData) {
            let roomId = jobData.room;
            const roomInfor = await roomModel.findOne({ _id: roomId })
              .lean()
              .exec();

            const userId = roomInfor.rentedBy;

            await roomModel.findOneAndUpdate({ _id: roomId }, {
              status: "available",
              $unset: { rentedBy: 1 },
            })
              .exec()

            //cập nhật lại floor
            let floorData = await floorModel
              .findOne({ rooms: roomId })
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
                  soonExpireContractRoom: roomGroup["soonExpireContract"]
                    ? roomGroup["soonExpireContract"].length
                    : 0,
                  rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                  depositedRoom: roomGroup["deposited"]
                    ? roomGroup["deposited"].length
                    : 0,
                }
              )
              .exec();

            //cập nhật lại motel

            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();

            let updateData = {
              availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
              rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
              depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
              soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
            };

            await motelRoomModel
              .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
              .exec();


            //Xóa job khỏi user
            let userUpdateData = {
              $pull: {
                jobs: jobData._id,
              },
            };

            await userModel
              .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
              .exec();
          }
        }
      }
      done();
    } catch (err) {
      done();
    }
  });


  //áp dụng cho các phòng có hợp đồng còn hạn qua tháng
  agenda.define("RemindUserMonthly15EveryDay_ExpireNextMonth", async (job, done) => {
    try {
      let data = job.attrs.data;

      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, 
        payDepositList: payDepositListModel
      } = global.mongoModel;

      const orderData = await orderModel.findOne({ _id: job.attrs.data.orderId })
        .lean()
        .exec();

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;

        if (orderData.isCompleted === false) {

          const userData = await userModel.findOne({ _id: userId })
            .lean()
            .exec();

          const jobData = await JobController.getJobNoImg(jobId);


          if (moment().date() <= 15) { //note gốc là: 15
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
  
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${moment().month()}/${moment().year()}`, //tháng trước
                  text: `Quý khách vui lòng đóng tiền phòng tháng ${moment().month()}/${moment().year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày 15/${moment().month() + 1}/${moment().year()}. Lưu ý: Nếu không hoàn thành đúng hạn, quý khách sẽ bị hủy phòng và mất cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }

            await global.agendaInstance.agenda.schedule(
              moment()
                .add(1, "days")
                .toDate(),
              "RemindUserMonthly15EveryDay_ExpireNextMonth",
              { orderId: job.attrs.data.orderId }
            );
          } else {
            const payDeposit = await payDepositListModel.create({
              room: jobData.room,
              user: jobData.user,
              job: jobData._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobData.deposit + jobData.afterCheckInCost,
              //thêm hạn thanh toán: note
            });

            const startTime = moment().startOf("months").startOf("day");
            const start = startTime.format("YYYY-MM-DD");
            const monInEnd = (moment().month() + 1) < 10 ? ("0" + (moment().month() + 1)) : (moment().month() + 1);
            const endTime = moment(`${moment().year()}-${monInEnd}-15`).endOf("day");
            const end = moment().year() + "-" + monInEnd + "-" + "15";

            const expireTime = endTime.add(15, "days");

            let electricNumber = await EnergyController.countElectricV2(jobData._id, start, end);

            if (electricNumber === null) {
              electricNumber = 0;
            }
            const roomId = jobData.room;
            const roomData = await roomModel.findOne({_id: roomId})
                                                                        .lean()
                                                                        .exec();
            const electricityPricePerKwh = roomData.electricityPrice;
            const electricPrice = electricNumber * electricityPricePerKwh;

            const dayOfMon = moment().daysInMonth(); // số ngày của tháng
            const numberDayStay = 15; 
            const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
            const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
            const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
            const roomPrice = (jobData.room.price / dayOfMon) * numberDayStay;
            const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;

            //oder  những ngày của tháng mới
            const orderDataNoPay = await orderModel.create({
              user: jobData.user,
              job: jobData._id,
              isCompleted: false,
              electricNumber: electricNumber,
              electricPrice: electricPrice,
              numberDayStay: numberDayStay,
              waterPrice: waterPrice,
              servicePrice: servicePrice,
              vehiclePrice: vehiclePrice,
              roomPrice: roomPrice,
              description: `Tiền phòng tháng ${moment().month() + 1}/${moment().year()}`,
              amount: amount,
              type: "monthly",
              startTime: startTime.toDate(),
              endTime: endTime.toDate(),
              expireTime: expireTime.toDate(),
            });

            const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                $addToSet: { orders: orderDataNoPay._id },
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );
            //Thêm order chưa được trả
            await payDepositListModel.findOneAndUpdate(
              {_id : payDeposit._id},
              {
                $addToSet: { ordersNoPay: orderDataNoPay._id },
              },
              { new: true }
            )

            const roomInfor = await roomModel.findOne({ _id: roomId })
              .lean()
              .exec();

            const userId = roomInfor.rentedBy;

            await roomModel.findOneAndUpdate({ _id: roomId }, {
              status: "available",
              $unset: { rentedBy: 1 },
            })
              .exec()

            //cập nhật lại floor
            let floorData = await floorModel
              .findOne({ rooms: roomId })
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
                  soonExpireContractRoom: roomGroup["soonExpireContract"]
                    ? roomGroup["soonExpireContract"].length
                    : 0,
                  rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                  depositedRoom: roomGroup["deposited"]
                    ? roomGroup["deposited"].length
                    : 0,
                }
              )
              .exec();

            //cập nhật lại motel

            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();

            let updateData = {
              availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
              rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
              depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
              soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
            };

            await motelRoomModel
              .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
              .exec();


            //Xóa job khỏi user
            let userUpdateData = {
              $pull: {
                jobs: jobData._id,
              },
            };

            await userModel
              .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
              .exec();
          }
        } else {
          // Đã thanh toán, cuối tháng tạo bill mới
          await global.agendaInstance.agenda.schedule(
            moment()
              .startOf("month")
              .add(1, "months")
              .toDate(),
            "CreateOrderForNextMonth",
            { jobId: jobId }
          );
        }
      }

    } catch (err) {
      done();
    }
  });

  //áp dụng cho các phòng sẽ hết hợp đồng trong tháng, hết từ ngày 15 đổ về trước
  agenda.define("RemindUserMonthlyToExpireDay_ExpireThisMonth", async (job, done) => {
    try {
      let data = job.attrs.data;

      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, 
        payDepositList: payDepositListModel
      } = global.mongoModel;

      const orderData = await orderModel.findOne({ _id: job.attrs.data.orderId })
        .lean()
        .exec();

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;

        if (orderData.isCompleted === false) {

          const userData = await userModel.findOne({ _id: userId })
            .lean()
            .exec();

          const jobData = await JobController.getJobNoImg(jobId);

          const checkInDay = jobData.checkInTime;
          const rentalPeriod = jobData.rentalPeriod;
          // const checkOutDay = new Date(checkInDay);
          // checkOutDay.setMonth(checkOutDay.getMonth() + rentalPeriod);
          const checkOutDay = moment(jobData.checkInTime).add(rentalPeriod, "months").subtract(1, "days"); // chính xác ngày cuối cùng còn được ở
          const timeCal = moment().subtract(1, "months"); // tháng trước

          // const parsedTime = moment(checkOutDay).format("DD/MM/YYYY");

          if (moment().date() <= checkOutDay.date()) { //lập lịch cho sau ngày hết hạn để hủy, không còn gửi mail
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
  
                // const files = ['a.txt', 'b.pdf', 'c.png']
  
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${timeCal.month() + 1}/${timeCal.year()}`,
                  text: `Quý khách vui lòng đóng tiền phòng tháng ${timeCal.month() + 1}/${timeCal.year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày ${checkOutDay.format("DD-MM-YYYY")}. Lưu ý: Nếu không hoàn thành đúng hạn, quý khách sẽ bị hủy phòng và mất cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }

            await global.agendaInstance.agenda.schedule(
              moment()
                .add(1, "days")
                .toDate(),
              "RemindUserMonthlyToExpireDay_ExpireThisMonth",
              { orderId: job.attrs.data.orderId }
            );
          } else {
            const payDeposit = await payDepositListModel.create({
              room: jobData.room,
              user: jobData.user,
              job: jobData._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobData.deposit + jobData.afterCheckInCost,
              //thêm hạn thanh toán: note
            });

            const startTime =  moment().startOf("months").startOf("day");
            const start = startTime.format("YYYY-MM-DD");
            const endTime = checkOutDay.endOf("day");
            const end = endTime.format("YYYY-MM-DD");

            const expireTime = endTime.add(15, "days");

            let electricNumber = await EnergyController.countElectricV2(jobData._id, start, end);

            if (electricNumber === null) {
              electricNumber = 0;
            }
            const roomId = jobData.room;
            const roomData = await roomModel.findOne({_id: roomId})
                                                                        .lean()
                                                                        .exec();
            const electricityPricePerKwh = roomData.electricityPrice;
            const electricPrice = electricNumber * electricityPricePerKwh;

            const dayOfMon = moment().daysInMonth(); // số ngày của tháng
            const numberDayStay = (Math.abs(checkOutDay.diff(checkOutDay.startOf("month"), "days")) + 1); //cộng 1: tính cả ngày checkIn
            const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
            const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
            const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
            const roomPrice = (jobData.room.price / dayOfMon) * numberDayStay;
            const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;

            //oder  những ngày của tháng mới
            const orderDataNoPay = await orderModel.create({
              user: jobData.user,
              job: jobData._id,
              isCompleted: false,
              electricNumber: electricNumber,
              electricPrice: electricPrice,
              numberDayStay: numberDayStay,
              waterPrice: waterPrice,
              servicePrice: servicePrice,
              vehiclePrice: vehiclePrice,
              roomPrice: roomPrice,
              description: `Tiền phòng tháng ${moment().month() + 1}/${moment().year()}`,
              amount: amount,
              type: "monthly",
              startTime: startTime.toDate(),
              endTime: endTime.toDate(),
              expireTime: expireTime.toDate(),
            });



            const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                $addToSet: { orders: orderDataNoPay._id },
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );

            //Thêm order chưa được trả
            await payDepositListModel.findOneAndUpdate(
              {_id : payDeposit._id},
              {
                $addToSet: { ordersNoPay: orderDataNoPay._id },
              },
              { new: true }
            )

            if (jobData) {
              let roomId = jobData.room;
              const roomInfor = await roomModel.findOne({ _id: roomId })
                .lean()
                .exec();

              const userId = roomInfor.rentedBy;

              await roomModel.findOneAndUpdate({ _id: roomId }, {
                status: "available",
                $unset: { rentedBy: 1 },
              })
                .exec()

              //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: roomId })
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
                    soonExpireContractRoom: roomGroup["soonExpireContract"]
                      ? roomGroup["soonExpireContract"].length
                      : 0,
                    rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                    depositedRoom: roomGroup["deposited"]
                      ? roomGroup["deposited"].length
                      : 0,
                  }
                )
                .exec();

              //cập nhật lại motel

              let motelRoomData = await motelRoomModel
                .findOne({ floors: floorData._id })
                .populate("floors")
                .lean()
                .exec();

              let updateData = {
                availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
                rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
                depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
                soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
              };

              await motelRoomModel
                .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
                .exec();


              //Xóa job khỏi user
              let userUpdateData = {
                $pull: {
                  jobs: jobData._id,
                },
              };

              await userModel
                .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
                .exec();
            }

          }
        } else {
          // Đã thanh toán, Tạo bill mới những ngày còn lại của tháng
          const jobData = await JobController.getJobNoImg(jobId);

          const checkInDay = jobData.checkInTime;
          const rentalPeriod = jobData.rentalPeriod;
          const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối cùng
          // const checkOutDay = new Date(checkInDay);
          
          //note: trường hợp không thanh toán, vậy order này không được tạo
          //vậy tổng 2 order sẽ không được thanh toán là tháng trước và những ngày còn lại
          // của tháng hiện tại
          //nếu người dùng thanh toán vào ngày cuối cùng - nghĩa là task kiểm tra vào đầu ngày sau  
          //ngày hết hạn, cần tạo task tạo order này cách thời gian kiểm tra ra (2 tiếng)
          await global.agendaInstance.agenda.schedule(
            checkOutDay.add(1, "days").add(2, "hours").toDate(),
            "CreateOrderForRestDayInMonBeforeExpireContract",
            { jobId: jobId }
          );
        }
      }

    } catch (err) {
      done();
    }
  });


  //áp dụng cho các phòng sẽ hết hợp đồng trong tháng, hết sau ngày 15
  agenda.define("RemindUserMonthlyToDay15_ExpireThisMonth", async (job, done) => {
    try {
      let data = job.attrs.data;

      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel, 
        payDepositList: payDepositListModel,
      } = global.mongoModel;

      const orderData = await orderModel.findOne({ _id: job.attrs.data.orderId })
        .lean()
        .exec();

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;

        const jobData = await JobController.getJobNoImg(jobId);

        if (orderData.isCompleted === false) {

          const userData = await userModel.findOne({ _id: userId })
            .lean()
            .exec();

          const checkInDay = jobData.checkInTime;
          const rentalPeriod = jobData.rentalPeriod;
          const checkOutDay = moment(jobData.checkInTime).add(rentalPeriod, "months").subtract(1, "days"); // chính xác ngày cuối cùng còn được ở
          const timeCal = moment().subtract(1, "months"); // tháng trước

          if (moment().date() <= 15) {
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
  
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${timeCal.month() + 1}/${timeCal.year()}`,
                  text: `Quý khách vui lòng đóng tiền phòng tháng ${timeCal.month() + 1}/${timeCal.year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày 15/${moment().month() + 1}/${moment().year()}. Lưu ý: Nếu không hoàn thành đúng hạn, quý khách sẽ bị hủy phòng và mất cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }

            await global.agendaInstance.agenda.schedule(
              moment()
                .add(1, "days")
                .toDate(),
              "RemindUserMonthlyToDay15_ExpireThisMonth",
              { orderId: job.attrs.data.orderId }
            );
          } else {
            const payDeposit = await payDepositListModel.create({
              room: jobData.room,
              user: jobData.user,
              job: jobData._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobData.deposit + jobData.afterCheckInCost,
              //thêm hạn thanh toán: note
            });

            const startTime = moment().startOf("months").startOf("day");
            const start = moment().startOf("months").format("YYYY-MM-DD");
            const monInEnd = (moment().month() + 1) < 10 ? ("0" + (moment().month() + 1)) : (moment().month() + 1);
            const endTime = moment(`${moment().year()}-${monInEnd}-15`).endOf("day");
            const end = moment().year() + "-" + monInEnd + "-" + "15";

            const expireTime = endTime.add(15, "days");

            let electricNumber = await EnergyController.countElectricV2(jobData._id, start, end);

            if (electricNumber === null) {
              electricNumber = 0;
            }
            const roomId = jobData.room;
            const roomData = await roomModel.findOne({_id: roomId})
                                                                        .lean()
                                                                        .exec();
            const electricityPricePerKwh = roomData.electricityPrice;
            const electricPrice = electricNumber * electricityPricePerKwh;

            const dayOfMon = moment().daysInMonth(); // số ngày của tháng
            const numberDayStay = 15; 
            const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
            const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
            const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
            const roomPrice = (jobData.room.price / dayOfMon) * numberDayStay;
            const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;

            //order  những ngày của tháng mới
            const orderDataNoPay = await orderModel.create({
              user: jobData.user,
              job: jobData._id,
              isCompleted: false,
              electricNumber: electricNumber,
              electricPrice: electricPrice,
              numberDayStay: numberDayStay,
              waterPrice: waterPrice,
              servicePrice: servicePrice,
              vehiclePrice: vehiclePrice,
              roomPrice: roomPrice,
              description: `Tiền phòng tháng ${moment().month() + 1}/${moment().year()}`,
              amount: amount,
              type: "monthly",
              startTime: startTime.toDate(),
              endTime: endTime.toDate(),
              expireTime: expireTime.toDate(),
            });

            const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                $addToSet: { orders: orderDataNoPay._id },
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );
            //Thêm order chưa được trả
            await payDepositListModel.findOneAndUpdate(
              {_id : payDeposit._id},
              {
                $addToSet: { ordersNoPay: orderDataNoPay._id },
              },
              { new: true }
            )

            if (jobData) {
              let roomId = jobData.room;
              const roomInfor = await roomModel.findOne({ _id: roomId })
                .lean()
                .exec();

              const userId = roomInfor.rentedBy;

              await roomModel.findOneAndUpdate({ _id: roomId }, {
                status: "available",
                $unset: { rentedBy: 1 },
              })
                .exec()

              //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: roomId })
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
                    soonExpireContractRoom: roomGroup["soonExpireContract"]
                      ? roomGroup["soonExpireContract"].length
                      : 0,
                    rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                    depositedRoom: roomGroup["deposited"]
                      ? roomGroup["deposited"].length
                      : 0,
                  }
                )
                .exec();

              //cập nhật lại motel

              let motelRoomData = await motelRoomModel
                .findOne({ floors: floorData._id })
                .populate("floors")
                .lean()
                .exec();

              let updateData = {
                availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
                rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
                depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
                soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
              };

              await motelRoomModel
                .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
                .exec();


              //Xóa job khỏi user
              let userUpdateData = {
                $pull: {
                  jobs: jobData._id,
                },
              };

              await userModel
                .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
                .exec();
            }

          }
        } else {
          // Đã thanh toán, Tạo bill mới những ngày còn lại của tháng
          const checkInDay = jobData.checkInTime;
          const rentalPeriod = jobData.rentalPeriod;
          const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối cùng

          if (checkOutDay.year() > moment().year()) {
            // ĐÃ GIAN HẠN
            await global.agendaInstance.agenda.schedule(
              moment()
                .startOf("month")
                .add("1", "months")
                .toDate(),
              "CreateOrderForNextMonth",
              { jobId: jobId }
            );
          } else if (checkOutDay.year() === moment().year()) {
            if (checkOutDay.month() > moment().month()) {
              // ĐÃ GIAN HẠN
              await global.agendaInstance.agenda.schedule(
                moment()
                  .startOf("month")
                  .add("1", "months")
                  .toDate(),
                "CreateOrderForNextMonth",
                { jobId: jobId }
              );
            } else if (checkOutDay.month() === moment().month()) {
              //TH1: khách còn thời gian để gia hạn
              //note: checking
              if ((checkOutDay.date() - moment().date()) >= 15) {
                const resDayExpire = checkOutDay.date() - moment().date() - 15;
                await global.agendaInstance.agenda.schedule(
                  moment()
                    .add(resDayExpire + 1, "days") //kiểm tra vào ngày đã hết hạn gia hạn tính tới thời điểm hiện tại
                    .toDate(),
                  "PendingCheckDayExpireContract",
                  { jobId: jobId }
                );
              } else {
                //TH2: khách đã hết thời gian để gia hạn
                //checked
                await global.agendaInstance.agenda.schedule(
                  moment().add("2", 'minutes').toDate(), //note: 5
                  "CreateOrderForRestDayInMonBeforeExpireContract",
                  { jobId: jobId }
                );
              }
            } else {
              //Không thể xảy ra
            }
          } else {
            // Không thể xảy ra
          }
        }
      }

    } catch (err) {
      done();
    }
  });

  agenda.define("CreateOrderForRestDayInMonBeforeExpireContract", async (job, done) => {
    try {
      console.log("CreateOrderForRestDayInMonBeforeExpireContract");
      // Init models
      const { order: orderModel, job: jobModel, room: roomModel } = global.mongoModel;

      let data = job.attrs.data;

      let resData = await JobController.getJobNoImg(job.attrs.data.jobId);

      if (resData) {
        if (resData.isActived && !(resData.isDeleted)) {
          const checkInDay = resData.checkInTime;
          const rentalPeriod = resData.rentalPeriod;
          const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối 

          const startTime = checkOutDay.startOf("months").startOf("day");
          const start = startTime.format("YYYY-MM-DD");
          const endTime = checkOutDay.endOf("day");
          const end = endTime.format("YYYY-MM-DD");

          const expireTime = endTime.add(15, "days");
          
          let electricNumber = await EnergyController.countElectricV2(job.attrs.data.jobId, start, end);
  
          if (electricNumber === null) {
            electricNumber = 0;
          }
          
          const roomId = resData.room;
          const roomData = await roomModel.findOne({_id: roomId})
                                                                      .lean()
                                                                      .exec();
          const electricityPricePerKwh = roomData.electricityPrice;
  
          const electricPrice = electricNumber * electricityPricePerKwh;

          const dayOfMon = moment(checkOutDay).daysInMonth(); // số ngày của tháng
          const numberDayStay = (Math.abs(checkOutDay.diff(checkOutDay.startOf("month"), "days")) + 1); //cộng 1: tính cả ngày checkIn
          const waterPrice = (roomData.waterPrice * roomData.person)/dayOfMon * numberDayStay;
          const servicePrice = roomData.garbagePrice/dayOfMon * numberDayStay;
          const vehiclePrice = (roomData.wifiPrice * roomData.vihicle)/dayOfMon * numberDayStay;
          const roomPrice = (resData.room.price / dayOfMon) * numberDayStay;
          const amount = roomPrice + vehiclePrice + servicePrice + waterPrice + electricPrice;
  
  
          const orderData = await orderModel.create({
            user: resData.user,
            job: resData._id,
            isCompleted: false,
            electricNumber: electricNumber,
            electricPrice: electricPrice,
            numberDayStay: numberDayStay,
            waterPrice: waterPrice,
            servicePrice: servicePrice,
            vehiclePrice: vehiclePrice,
            roomPrice: roomPrice,
            description: `Tiền phòng tháng ${checkOutDay.month() + 1}/${checkOutDay.year()}`,
            amount: amount,
            type: "monthly",
            startTime: startTime.toDate(),
            endTime: endTime.toDate(),
            expireTime: expireTime.toDate(),
          });
  
          resData = await jobModel.findOneAndUpdate(
            { _id: resData._id },
            {
              $addToSet: { orders: orderData._id },
              currentOrder: orderData._id,
              status: "pendingMonthlyPayment",
            },
            { new: true }
          );
  
          await global.agendaInstance.agenda.schedule(
            moment().add("2", 'minutes').toDate(), //note: 5
            "CheckOrderStatus_In3LastDayExpireContract",
            { orderId: orderData._id }
          );
  
        } 
      }
      done();
    } catch (err) {
      done();
    }
  });


  agenda.define("CheckOrderStatus_In3LastDayExpireContract", async (job, done) => {
    try {
      // Init models
      const {
        order: orderModel,
        job: jobModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
        user: userModel,
        payDepositList: payDepositListModel,
      } = global.mongoModel;

      let data = job.attrs.data;

      let orderData = await orderModel.findOne(job.attrs.data.orderId);

      if (orderData) {
        const jobId = orderData.job;
        const userId = orderData.user._id;
        const jobData = await JobController.getJobNoImg(jobId);
        if (!orderData.isCompleted) {
          const userData = await userModel.findOne({ _id: userId })
            .lean()
            .exec();

          const checkInDay = jobData.checkInTime;
          const rentalPeriod = jobData.rentalPeriod;
          const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối cùng
          const checkOutDayPlus3 = checkOutDay.add(3, "days");// số ngày để đóng hóa đơn cuối (3 ngày: ngày hiện tại + 2 ngày)
  
          if (moment().diff(checkOutDayPlus3) <= 0) {
            await global.agendaInstance.agenda.schedule(
              moment()
                .add("1", "days")
                .toDate(),
              "CheckOrderStatus_In3LastDayExpireContract",
              { orderId: orderData._id }
            );

            //gửi lần cuối vào đầu ngày cuối (lấy hiện tại trừ thời gian hết hạn)
            if (userData) {
              if (userData.email) {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: 'cr7ronadol12345@gmail.com',
                    pass: 'wley oiaw yhpl oupy'
                  }
                });
    
                const mailOptions = {
                  from: 'cr7ronadol12345@gmail.com',
                  // to: 'quyetthangmarvel@gmail.com',
                  to: userData.email,
                  subject: `[${jobData.room.name}] THÔNG BÁO ĐÓNG TIỀN PHÒNG THÁNG ${checkOutDay.month() + 1}/${checkOutDay.year()}`,
                  text: `Quý khách vui lòng đóng tiền phòng tháng ${checkOutDay.month() + 1}/${checkOutDay.year()} cho phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name}. Hạn đóng tới hết ngày ${checkOutDayPlus3.format("DD-MM-YYYY")}. Lưu ý: Nếu không thực hiện đóng hóa đơn này, quý khách sẽ không được hoàn trả tiền cọc.`,
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                  if (error) {
                    console.error(error);
                  } else {
                    console.log('Email đã được gửi: ' + info.response);
                  }
                });
  
                console.log(`Gửi tới mail: ${userData.email}`);
              }
            }
          } else {
            const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
              { orders: orderData._id },
              {
                isActivated: false,
                isDeleted: true,
              },
              { new: true }
            );

            await payDepositListModel.create({
              room: jobDataAfterUpdate.room,
              user: jobDataAfterUpdate.user,
              job: jobDataAfterUpdate._id,
              ordersNoPay: orderData._id,
              type: "noPayDeposit",
              reasonNoPay: "noPayMonthly",
              amount: jobDataAfterUpdate.deposit + jobDataAfterUpdate.afterCheckInCost,
              //thêm hạn thanh toán: note
            });

            if (jobData) {
              let roomId = jobData.room;
              const roomInfor = await roomModel.findOne({ _id: roomId })
                .lean()
                .exec();

              const userId = roomInfor.rentedBy;

              await roomModel.findOneAndUpdate({ _id: roomId }, {
                status: "available",
                $unset: { rentedBy: 1 },
              })
                .exec()

              //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: roomId })
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
                    soonExpireContractRoom: roomGroup["soonExpireContract"]
                      ? roomGroup["soonExpireContract"].length
                      : 0,
                    rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                    depositedRoom: roomGroup["deposited"]
                      ? roomGroup["deposited"].length
                      : 0,
                  }
                )
                .exec();

              //cập nhật lại motel

              let motelRoomData = await motelRoomModel
                .findOne({ floors: floorData._id })
                .populate("floors")
                .lean()
                .exec();

              let updateData = {
                availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
                rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
                depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
                soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
              };

              await motelRoomModel
                .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
                .exec();


              //Xóa job khỏi user
              let userUpdateData = {
                $pull: {
                  jobs: jobData._id,
                },
              };

              await userModel
                .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
                .exec();
            }
          }

          //new------------
        } else {
          const jobDataAfterUpdate = await jobModel.findOneAndUpdate(
            { orders: orderData._id },
            {
              isActivated: false,
              isDeleted: true,
            },
            { new: true }
          );

          await payDepositListModel.create({
            room: jobDataAfterUpdate.room,
            user: jobDataAfterUpdate.user,
            job: jobDataAfterUpdate._id,
            type: "payDeposit",
            reasonNoPay: "unknown",
            amount: jobDataAfterUpdate.deposit + jobDataAfterUpdate.afterCheckInCost,
            //thêm hạn thanh toán: note
          });

          if (jobData) {
            let roomId = jobData.room;
            const roomInfor = await roomModel.findOne({ _id: roomId })
              .lean()
              .exec();

            const userId = roomInfor.rentedBy;

            await roomModel.findOneAndUpdate({ _id: roomId }, {
              status: "available",
              $unset: { rentedBy: 1 },
            })
              .exec()

            //cập nhật lại floor
            let floorData = await floorModel
              .findOne({ rooms: roomId })
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
                  soonExpireContractRoom: roomGroup["soonExpireContract"]
                    ? roomGroup["soonExpireContract"].length
                    : 0,
                  rentedRoom: roomGroup["rented"] ? roomGroup["rented"].length : 0,
                  depositedRoom: roomGroup["deposited"]
                    ? roomGroup["deposited"].length
                    : 0,
                }
              )
              .exec();

            //cập nhật lại motel

            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();

            let updateData = {
              availableRoom: lodash.sumBy(motelRoomData.floors, "availableRoom"),
              rentedRoom: lodash.sumBy(motelRoomData.floors, "rentedRoom"),
              depositedRoom: lodash.sumBy(motelRoomData.floors, "depositedRoom"),
              soonExpireContractRoom: lodash.sumBy(motelRoomData.floors, "soonExpireContractRoom"),
            };

            await motelRoomModel
              .findOneAndUpdate({ _id: motelRoomData._id }, updateData)
              .exec();


            //Xóa job khỏi user
            let userUpdateData = {
              $pull: {
                jobs: jobData._id,
              },
            };

            await userModel
              .findOneAndUpdate({ _id: userId }, userUpdateData, { new: true })
              .exec();
          }
        }
      }
      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("PendingCheckDayExpireContract", async (job, done) => {
    try {
      const jobId = job.attrs.data.jobId;
      const jobData = await JobController.getJobNoImg(job.attrs.data.jobId);

      if (jobData) {
        const checkInDay = jobData.checkInTime;
        const rentalPeriod = jobData.rentalPeriod;
        const checkOutDay = moment(checkInDay).add(rentalPeriod, "months").subtract(1, "days"); //  chính xác ngày ở cuối cùng

        if (checkOutDay.year() > moment().year()) {
          //ĐÃ GIAN HẠN
          await global.agendaInstance.agenda.schedule(
            moment()
              .startOf("month")
              .add("1", "months")
              .toDate(),
            "CreateOrderForNextMonth",
            { jobId: jobId }
          );
        } else if (checkOutDay.year() === moment().year()) {
          if (checkOutDay.month() > moment().month()) {
            // ĐÃ GIAN HẠN
            await global.agendaInstance.agenda.schedule(
              moment()
                .startOf("month")
                .add("1", "months")
                .toDate(),
              "CreateOrderForNextMonth",
              { jobId: jobId }
            );
          } else if (checkOutDay.month() === moment().month()) {
            //Hết thời gian gia hạn, hết hợp đồng
            await global.agendaInstance.agenda.schedule(
              moment().add("2", 'minutes').toDate(), //note: 5
              "CreateOrderForRestDayInMonBeforeExpireContract",
              { jobId: jobId }
            );
          } 
        } 
      }

      done();
    } catch (err) {
      console.log({ err });
      done();
    }
  })


  agenda.define("Test1", async (job, done) => {
    try {
      console.log("Test1");

      const { order: orderModel } = global.mongoModel;

      const orderData = await orderModel.create({
        user: "test1",
        job: "test1",
        isCompleted: false,
        //Thêm trường điện nước
        description: `Tiền phòng tháng ${moment().month()}/${moment().year()}`, //vì là tháng trước đó
        // amount:
        //   (resData.room.price / 30) *
        //   moment(resData.checkInTime)
        //     .endOf("month")
        //     .diff(moment(resData.checkInTime), "days"),
        amount: 0,
        type: "monthly",
      });

      await global.agendaInstance.agenda.schedule(
        new Date(),
        "Test2",
        { idOrder: orderData._id }
      );

      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("Test2", async (job, done) => {
    try {
      const { order: orderModel } = global.mongoModel;
      console.log("Test2");

      const orderDate = await orderModel.findOne(job.attrs.data.idOrder)

      console.log({ orderDate });

      await global.agendaInstance.agenda.schedule(
        moment().add("1", "minutes").toDate(),
        "Test3",
        { idOrder: 1 }
      );

      done();
    } catch (err) {
      done();
    }
  });

  agenda.define("Test3", async (job, done) => {
    try {
      console.log("Test3");

      done();
    } catch (err) {
      done();
    }
  });


  // (async function () {
  //   await agenda.start();

  // cuối mỗi tháng, lúc 0h00 của ngày đầu tiên tháng tiếp theo
  // await agenda.every('0 0 1 * *', 'AutoChangeStatusRoomExpireContract');

  //đầu mỗi ngày
  // await agenda.every('0 0 * * *', 'AutoChangeStatusRoomExpireContract');

  // await agenda.schedule('in 2 minutes', 'AutoChangeStatusRoom');


  // await agenda.schedule('in 2 minutes', 'CreateOrder');
  // await agenda.every('0 0 * * *', 'AutoChangeStatusRoomExpireDeposit');

  // await agenda.schedule('in 2 minutes', 'CreateOrder');
  // })();

};
