import * as mongoose from "mongoose";
var nodemailer = require('nodemailer');
import JobController from "../../../controllers/homeKey/job.controller";
import * as lodash from "lodash";
import * as moment from "moment";


export default agenda => {
    // create order
    agenda.define('AutoChangeStatusRoomExpireContract', async (job, done) => {

        console.log("AutoChangeStatusRoomExpireContract");
       
        try {
        const {
            room: roomModel,
            floor: floorModel,
            motelRoom: motelRoomModel,
            job: jobModel,
            user: userModel,
            order: orderModel,
        } = global.mongoModel;
    
        const dayExpireContract = new Date();
        console.log({dayExpireContract});
    
        const currentDay = new Date();
        const tempDay = new Date();
        const currentDayString = tempDay.toISOString().split('T')[0];
        console.log({currentDayString});
        console.log("type currentDayString", typeof(currentDayString));
    
        const listJobAbleExpire = await jobModel.find({
            isDeleted: false,
            checkInTime: {
            $lte : dayExpireContract
            }
        });
        const listJobAbleExpireLength: number = listJobAbleExpire.length;
        if (listJobAbleExpireLength !== 0) {
            let listJobExpire = [];
            for (let i = 0; i < listJobAbleExpireLength; i ++) {
                const checkInTimeExpire = listJobAbleExpire[i].checkInTime;
      
                const checkOutTime = new Date(checkInTimeExpire); 
        
                checkOutTime.setMonth(checkOutTime.getMonth() + listJobAbleExpire[i].rentalPeriod); // thành checkout time
                
                console.log({checkOutTime});
        
                if (checkOutTime <= currentDay) {
                    console.log("xxxxxxxxxx")
                    listJobExpire.push(listJobAbleExpire[i]);
                } 
            }
            console.log({currentDay});
            console.log("listJobExpire", listJobExpire);
            
            const listJobExpireLength = listJobExpire.length;
            for (let i = 0; i <listJobExpireLength; i ++) {
                if (listJobExpire[i].room && listJobExpire[i].user) {
                    //Gửi mail thông báo
                    const userInfor = await userModel.findOne({_id: listJobExpire[i].user})
                                                                            .lean()
                                                                            .exec();
                    if (userInfor.email) {
                    //gửi mail thông báo hết hạn thuê phòng
                        console.log(`Gửi tới mail: ${userInfor.email}`);
                    } else {
                        console.log(`User id: ${listJobExpire[i].user} không được tìm thấy hoặc chưa cập nhật email`);
                    }
        
                    //xóa job: isDeleted: true
                    const jobData = await JobController.getJobNoImg(listJobExpire[i]._id);
        
                    let resData = await jobModel
                    .findOneAndUpdate({ _id: listJobExpire[i]._id }, {isDeleted: true})
                    .lean()
                    .exec();
        
                    // xóa order
                    // await orderModel.remove({ _id: { $in: jobData.orders } }).exec();
        
                    //Cập nhật trạng thái phòng, xóa người thuê
        
                    const roomInfor = await roomModel.findOne({_id: listJobExpire[i].room})
                                                                                .lean()
                                                                                .exec()
                    const userId = roomInfor.rentedBy;    
        
                    await roomModel.findOneAndUpdate({_id: listJobExpire[i].room}, {
                    status: "available",
                    $unset: { rentedBy: 1 },
                    })
                    .exec()
        
                    //cập nhật lại floor
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
        
                } else {
                    console.log("Job không chứa room hoặc user");
                }
            }
            }

            done();
        } catch (err) {
            done();
        }
    });


    agenda.define('AutoChangeStatusRoomExpireDeposit', async (job, done) => {

        console.log("AutoChangeStatusRoomExpireDeposit");
       
        try {
            const {
              room: roomModel,
              floor: floorModel,
              motelRoom: motelRoomModel,
              job: jobModel,
              user: userModel,
              order: orderModel,
            } = global.mongoModel;
      
      
            // Hủy cọc sau 7 ngày
            const dayCancelDeposited : Date = new Date();
            console.log({dayCancelDeposited});
      
            
            dayCancelDeposited.setDate(dayCancelDeposited.getDate() - 7);
            const tempDay = dayCancelDeposited.toISOString().split('T')[0];
            console.log("day - 7: ", tempDay);
      
            const startDayQuery = new Date(tempDay);
            console.log({startDayQuery})
      
            const endDayQuery = new Date(tempDay);
            endDayQuery.setHours(30, 59, 59, 59.99);
            console.log({endDayQuery});
      
            const roomInfor = await roomModel.find({
              status: "deposited",
            });
            console.log({roomInfor});
      
            if(roomInfor.length !== 0) {
              let listJobEpireDeposit = [];
              for (let i = 0; i < roomInfor.length; i++) {
                const jobByRoom = await jobModel.findOne({
                  isDeleted: false,
                  room: roomInfor[i]._id,
                  checkInTime: {
                    // $gte: startDayQuery,
                    $lte: startDayQuery,
                  }
                });
                if (jobByRoom) {
                  listJobEpireDeposit.push(jobByRoom);
                }
                
              }
      
              console.log("listJobEpireDeposit", listJobEpireDeposit);
              console.log("listJobEpireDeposit", listJobEpireDeposit.length);
      
              if (listJobEpireDeposit.length !== 0) {
                for (let i = 0 ; i < listJobEpireDeposit.length; i++) {
                  // Cập nhật cả motel, floor, xóa job
      
                  
      
                  const jobData = await JobController.getJobNoImg(listJobEpireDeposit[i]._id);
      
                  
                  //xóa job: isDeleted: true
                  let resData = await jobModel
                    .findOneAndUpdate({ _id: listJobEpireDeposit[i]._id }, {isDeleted: true})
                    .lean()
                    .exec();
      
                    
      
                  //xóa order
                  // await orderModel.remove({ _id: { $in: jobData.orders } }).exec();
      
                  //Cập nhật trạng thái phòng, xóa người thuê
      
                  const roomInfor = await roomModel.findOne({_id: listJobEpireDeposit[i].room})
                                                                              .lean()
                                                                              .exec()
                  const userId = roomInfor.rentedBy;    
      
                  await roomModel.findOneAndUpdate({_id: listJobEpireDeposit[i].room}, {
                    status: "available",
                    $unset: { rentedBy: 1 },
                  })
                  .exec()
      
                  //cập nhật lại floor
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
                console.log("Hiện tại chưa có phòng nào quá hạn cọc giữ phòng!")
              }
              
            } else {
              console.log("Hiện không có phòng nào được cọc!");
            }
            
            done();
        } catch (err) {
            done();
        }
    });

    agenda.define('RemindUserRenewContract', async (job, done) => {

      console.log("RemindUserRenewContract");
    

      try {
        const {
          room: roomModel,
          floor: floorModel,
          motelRoom: motelRoomModel,
          job: jobModel,
          user: userModel,
          order: orderModel,
        } = global.mongoModel;
  
        const dayCancelDeposited = new Date();
  
        // dayCancelDeposited.setMonth(dayCancelDeposited.getMonth() - 1);
        // dayCancelDeposited.setHours(7, 0, 0, 0);  // cần xem lại để nó về 0h00p
        console.log({dayCancelDeposited});
  
        const currentDay = new Date();
        // currentDay.setHours(7, 0, 0, 0);
        console.log({currentDay});
  
        const listJobAbleExpire = await jobModel.find({
          isDeleted: false,
          checkInTime: {
            $lte : dayCancelDeposited
          }
        });
        const listJobAbleExpireLength: number = listJobAbleExpire.length;
        if (listJobAbleExpireLength !== 0) {
          let listJobExpireBeforeMon = [];
          for (let i = 0; i < listJobAbleExpireLength; i ++) {
            const checkInTime = listJobAbleExpire[i].checkInTime;
            console.log("tiiii", (checkInTime));
            checkInTime.setMonth(checkInTime.getMonth() + listJobAbleExpire[i].rentalPeriod - 1);
  
            console.log("iii", checkInTime);
  
            // ở đây điều kiện đang là nhắc nhở hằng ngày cho đến khi hết hợp đồng trong 1 tháng
            if (checkInTime <= currentDay) {
              const idRoomInJob = listJobAbleExpire[i].room;
  
              const roomInforOfJob = await roomModel.findOne({_id: idRoomInJob})
                                                                                    .lean()
                                                                                    .exec();
  
              if (roomInforOfJob) {
                if (roomInforOfJob.status === "rented") {
                  listJobExpireBeforeMon.push(listJobAbleExpire[i]);
                } 
              }                                                                      
            } 
          }
          console.log("listJobAbleExpireMon", listJobExpireBeforeMon);
          
          const listJobExpireBeforeMonLength = listJobExpireBeforeMon.length;
          for (let i = 0; i <listJobExpireBeforeMonLength; i ++) {
            if (listJobExpireBeforeMon[i].room && listJobExpireBeforeMon[i].user) {
              //Gửi mail nhắc nhở
              const userInfor = await userModel.findOne({_id: listJobExpireBeforeMon[i].user})
                                                                      .lean()
                                                                      .exec();
  
              const jobData = await JobController.getJobNoImg(listJobExpireBeforeMon[i]._id);
  
              console.log("jobData", jobData);
  
              if (userInfor.email) {
                //send mail
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                      user: 'cr7ronadol12345@gmail.com',
                      pass: 'wley oiaw yhpl oupy'
                  }
                });
  
                // const files = ['a.txt', 'b.pdf', 'c.png'];
                const checkInDay = jobData.checkInTime;
                const rentalPeriod = jobData.rentalPeriod;
                const checkOutDay = new Date(checkInDay);
                checkOutDay.setMonth(checkOutDay.getMonth() + rentalPeriod);
  
                const parsedTime = moment(checkOutDay).format("DD/MM/YYYY");
                // checkOutDay.toISOString().split('T')[0]
  
                const mailOptions = {
                    from: 'cr7ronadol12345@gmail.com',
                    // to: 'quyetthangmarvel@gmail.com',
                    to: userInfor.email,
                    subject: `[${jobData.room.name}] THÔNG BÁO GIA HẠN HỢP ĐỒNG TRỌ`,
                    text: `Phòng ${jobData.room.name} thuộc dãy ${jobData.motelRoom.name} của quý khách sẽ hết hợp đồng vào ${parsedTime}. Vui lòng truy cập trang web: http://homeslands.net:3006/ thực hiện đăng nhập rồi vào đường dẫn http://homeslands.net:3006/job-detail/${listJobExpireBeforeMon[i]._id} để gian hạn hợp đồng. Lưu ý: Hợp đồng chỉ có thể gia hạn trước thời gian hết hạn 15 ngày.`,
                    // attachments: files.map(file => ({
                    //     filename: file,
                    //     // path: filePath
                    // }))
                };
  
                // Gửi email
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.error(error);
                    } else {
                        console.log('Email đã được gửi: ' + info.response);
                    }
                });
                
                console.log(`Gửi tới mail: ${userInfor.email}`);
              } else {
                console.log(`User id: ${listJobExpireBeforeMon[i].user} không được tìm thấy hoặc chưa cập nhật email`);
              }
  
              // Đổi trạng thái phòng thành: soonExpireContract
              await roomModel.findOneAndUpdate({_id: listJobExpireBeforeMon[i].room}, {
                status: 'soonExpireContract',
              })
  
              // Cập nhật lại  room, floor số lượng: thêm trường => cần xem xét
  
              // //cập nhật lại floor
              let floorData = await floorModel
                .findOne({ rooms: jobData.room._id })
                .populate("rooms")
                .lean()
                .exec();
              const roomGroup = lodash.groupBy(floorData.rooms, (room) => {
                return room.status;
              });

              console.log({roomGroup});
  
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
  
            } else {
              console.log("Job không chứa room hoặc user");
            }
          }
         }
         done();
      } catch(err) {
        console.log({err});
        done();
      }
  });

    (async function () {
        await agenda.start();

        // cuối mỗi tháng, lúc 0h00 của ngày đầu tiên tháng tiếp theo
        // await agenda.every('0 0 1 * *', 'AutoChangeStatusRoomExpireContract');

        //đầu mỗi ngày
        // await agenda.every('0 0 * * *', 'AutoChangeStatusRoomExpireContract');

        // await agenda.schedule('in 2 minutes', 'AutoChangeStatusRoomExpireContract');


        // await agenda.schedule('in 2 minutes', 'AutoChangeStatusRoomExpireDeposit');
        // await agenda.every('0 0 * * *', 'AutoChangeStatusRoomExpireDeposit');

        // await agenda.schedule('in 2 minutes', 'RemindUserRenewContract');
        await agenda.every('0 0 * * *', 'RemindUserRenewContract');

    })();
} 