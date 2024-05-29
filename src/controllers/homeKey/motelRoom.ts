import { NextFunction, Request, Response } from "express";
import GoogleMapService from "../../services/googleMap";
import ImageService from "../../services/image";
import HttpResponse from "../../services/response";
import { helpers } from "../../utils";
import AddressController from "../address";
import * as mongoose from "mongoose";
import * as PdfPrinter from "pdfmake";
import moment = require("moment");
import BillController from "./bill.controller";
import { roomStatus } from "../../enums";
import { index } from "libs/typegoose";
const ObjectId = mongoose.Types.ObjectId;

export default class MotelRoomController {
  /**
   * @swagger
   * tags:
   *   - name: MotelRoom
   *     description: MotelRoom Control
   */

  /**
   * @swagger
   * /v1/homeKey/motelRoom/list:
   *   get:
   *     description: Get list motel room
   *     tags: [MotelRoom]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: keyword
   *         in: query
   *         type:  string
   *         description: Keyword to find motel room
   *       - name: sortBy
   *         in: query
   *         type:  string
   *         description: Sort By
   *         enum:
   *              - createdAt
   *              - updatedAt
   *       - name: sortType
   *         in: query
   *         type:  string
   *         description: Sort Type
   *         enum:
   *              - ascending
   *              - descending
   *       - name: size
   *         in: query
   *         description: Number of user returned
   *         type:  integer
   *         default: 20
   *       - name: page
   *         in: query
   *         default: 0
   *         description: Current page
   *         type:  integer
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */

  static async getMotelRoomList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const {
        motelRoom: motelRoomModel,
        image: imageModel,
      } = global.mongoModel;
      let { sortBy, role, size, page, keyword } = req.query;
      size === null ? null : size;
      page === null ? null : page;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "addresses",
            localField: "address",
            foreignField: "_id",
            as: "address",
          },
        },
        { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "images",
            localField: "images",
            foreignField: "_id",
            as: "images",
          },
        },
        { $unwind: { path: "$images", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
          },
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            "address.location": "$address.geometry.location",
          },
        },
        {
          $project: {
            "owner.token": 0,
            "owner.password": 0,
            "owner.role": 0,
            "owner.active": 0,
            "owner.isVerified": 0,
            "owner.signUpCompleted": 0,
            "owner.isDeleted": 0,
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
        }
        condition.push({ $sort: sort });
      }

      const resData = helpers.changeTimeZone(
        await motelRoomModel.paginate(size, page, condition)
      );
      console.log("getMotelRoomList");
      if (resData) {
        const n = resData["data"].length;
        for (let i = 0; i < n; i++) {
          if (resData["data"][i].images) {
            if (Array.isArray(resData["data"][i].images)) {
              if (resData["data"][i].images.length > 0) {
                for (let j = 0; j < resData["data"][i].images.length; j++) {
                  const dataimg = await imageModel.findOne({
                    _id: resData["data"][i].images[j],
                  });
                  if (dataimg) {
                    resData["data"][i].images[j] = await helpers.getImageUrl(
                      dataimg
                    );
                  }
                }
              }
            }
            // imag not array
            else {
              const dataimg = await imageModel.findOne({
                _id: resData["data"][i].images,
              });
              if (dataimg) {
                resData["data"][i].images = await helpers.getImageUrl(dataimg);
              }
            }
          }
        }
      }

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  static async getMotelRoomListByOwner(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const idOwner = req.params.id;
      console.log({idOwner});

      const {
        motelRoom: motelRoomModel,
        image: imageModel,
      } = global.mongoModel;

      let resData = [];

      resData = await motelRoomModel.find({owner: idOwner}).populate("address").lean().exec();

      if(resData) {
        if(resData.length > 0) {
          for(let i = 0; i < resData.length; i++) {
            if (resData[i].images && (resData[i].images.length > 0)) {
              const dataimg = await imageModel.findOne({
                _id: resData[i].images[0],
              });
              if (dataimg) {
                resData[i].file = await helpers.getImageUrl(dataimg);
              } else {
                resData[i].file = null;
              }
            } else {
              resData[i].file = null;
            }
          }
        }
      }
      console.log({resData});

      if(!resData) {
        resData = [];
      }
      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }
  static async getMotelRoomListAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init user model`
      const {
        motelRoom: motelRoomModel,
        image: imageModel,
      } = global.mongoModel;
      let { sortBy, role, size, page, keyword } = req.query;
      size === null ? null : size;
      page === null ? null : page;
      const sortType = req.query.sortType === "ascending" ? 1 : -1;
      let condition, sort;

      condition = [
        {
          $lookup: {
            from: "addresses",
            localField: "address",
            foreignField: "_id",
            as: "address",
          },
        },
        { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
          },
        },
        { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            "address.location": "$address.geometry.location",
          },
        },
        {
          $project: {
            "owner.token": 0,
            "owner.password": 0,
            "owner.role": 0,
            "owner.active": 0,
            "owner.isVerified": 0,
            "owner.signUpCompleted": 0,
            "owner.isDeleted": 0,
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
        }
        condition.push({ $sort: sort });
      }

      let resData = helpers.changeTimeZone(
        await motelRoomModel.paginate(size, page, condition)
      );
      console.log(2222);
      if (resData) {
        const n = resData["data"].length;
        for (let i = 0; i < n; i++) {
          if (resData["data"][i].images) {
            if (Array.isArray(resData["data"][i].images)) {
              if (resData["data"][i].images.length > 0) {
                for (let j = 0; j < resData["data"][i].images.length; j++) {
                  const dataimg = await imageModel.findOne({
                    _id: resData["data"][i].images[j],
                  });
                  if (dataimg) {
                    resData["data"][i].images[j] = await helpers.getImageUrl(
                      dataimg
                    );
                  }
                }
              }
            }
            // imag not array
            else {
              const dataimg = await imageModel.findOne({
                _id: resData["data"][i].images,
              });
              if (dataimg) {
                resData["data"][i].images = await helpers.getImageUrl(dataimg);
              }
            }
          }

          const idMotelRom = resData["data"][i]._id;
          resData["data"][
            i
          ].dataPayment = await MotelRoomController.getMotelRoomByIdMotelRoom(
            idMotelRom
          );
        }
      }

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }
  static async getMotelRoomByIdMotelRoom(IdMotelRoom) {
    const { job: jobModel } = global.mongoModel;
    const { order: orderModel } = global.mongoModel;
    const sortBy = null;
    const size = null;
    const page = null;
    const sortType = 1;
    let condition, sort;

    condition = [
      {
        $lookup: {
          from: "floors",
          localField: "room",
          foreignField: "rooms",
          as: "floor",
        },
      },
      { $unwind: { path: "$floor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "motelRooms",
          localField: "floor._id",
          foreignField: "floors",
          as: "motelRoom",
        },
      },
      { $unwind: { path: "$motelRoom", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "images",
          localField: "images",
          foreignField: "_id",
          as: "images",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "currentOrder",
          foreignField: "_id",
          as: "currentOrder",
        },
      },
      {
        $unwind: { path: "$currentOrder", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "rooms",
          localField: "room",
          foreignField: "_id",
          as: "room",
        },
      },
      { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          motelRoom: { $exists: true },
          "motelRoom._id": mongoose.Types.ObjectId(IdMotelRoom),
          isCompleted: true,
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
      }
      condition.push({ $sort: sort });
    }

    let resData = await jobModel.paginate(size, page, condition);

    for (let i = 0; i < resData.data.length; i++) {
      delete resData.data[i].motelRoom;
      if (resData.data[i].images) {
        resData.data[i].images = helpers.getImageUrl(
          resData.data[i].images,
          true
        );
      }
      const arrTemp = [];
      for (let j = 0; j < resData.data[i].orders.length; j++) {
        const idOrder = resData.data[i].orders[j];
        const orderData = await orderModel
          .findOne({ _id: idOrder })
          .lean()
          .exec();
        arrTemp.push(orderData);
      }
      resData.data[i].orderData = arrTemp;
    }
    return resData;
  }
  /**
   * @swagger
   * definitions:
   *   MotelRoom:
   *     properties:
   *       name:
   *         type:  string
   *         description: name of motel room
   *       address:
   *         type:  string
   *         description: motel room address
   *       contactPhone:
   *         type:  string
   *         description: phone number to contact (Format:+84xxxxxxxxx)
   *       floors:
   *         type:  array
   *         items:
   *           type:  number
   *         description: list total room per floor
   *       rentedRoom:
   *         type:  number
   *         description: number of rented room
   *       depositedRoom:
   *         type:  number
   *         description: number of deposited room
   *       rooms:
   *         type:  array
   *         items:
   *           type:  object
   *           properties:
   *             roomKey:
   *                type:  string
   *                description: Example F1-R1
   *             availableDate:
   *                type:  string
   *                description: MM/DD/YYYY
   *         description: list available room object
   *       roomAcreage:
   *         type:  number
   *         description: acreage of room (m2)
   *       minPrice:
   *         type:  number
   *         description: minimum price of motel room
   *       maxPrice:
   *         type:  number
   *         description: maximum price of motel room
   *       electricityPrice:
   *         type:  number
   *         description: electricity price of motel room
   *       waterPrice:
   *         type:  number
   *         description: water price of motel room
   *       utilities:
   *         type:  array
   *         items:
   *           type:  string
   *         description: list of utilities
   *       description:
   *         type:  string
   *         description: description of motel room
   */

  /**
   * @swagger
   * /v1/homeKey/motelRoom:
   *   post:
   *     description: Create motel room
   *     tags: [MotelRoom]
   *     parameters:
   *       - name: body
   *         in: body
   *         required:  true
   *         description: motel room data
   *         schema:
   *           type:  object
   *           $ref: '#definitions/MotelRoom'
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *          - auth: []
   */

  static async createMotelRoom(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init  models
      const {
        motelRoom: motelRoomModel,
        user: userModel,
        floor: floorModel,
        room: roomModel,
        address: addressModel,
        image: imageModel,
      } = global.mongoModel;

      let { body: data } = req;

      const googleMap = new GoogleMapService();

      const googleMapData = await googleMap.getAddressDetail(data.address);

      const addressData = await AddressController.createAddress(
        googleMapData.results[0]
      );

      let rentedRoomMotel = parseInt(data.rentedRoom);
      let depositedRoomRoomMotel = parseInt(data.depositedRoom);

      let initMotelRoomData = {
        name: data.name,
        address: addressData._id,
        contactPhone: data.contactPhone,
        owner: req["userId"],
        totalFloor: data.floors.length,
        totalRoom: 0,
        availableRoom: 0,
        rentedRoom: parseInt(data.rentedRoom),
        depositedRoom: parseInt(data.depositedRoom),
        roomAcreage: parseInt(data.roomAcreage),
        price: (parseInt(data.minPrice) + parseInt(data.maxPrice)) / 2,
        minPrice: parseInt(data.minPrice),
        maxPrice: parseInt(data.maxPrice),
        electricityPrice: data.electricityPrice,
        waterPrice: data.waterPrice,
        garbagePrice: data.garbagePrice,
        wifiPrice: data.wifiPrice,
        description: data.description,
        floors: [],
        utilities: data.utilities,
        // images: ''
        images: (await imageModel.find({ description: "motel" })).map(
          (image) => image._id
        ),
      };

      let nCompletedFloors = 0;
      for (let i = 0; i < initMotelRoomData.totalFloor; i++) {
        initMotelRoomData.totalRoom += data.floors[i];
        let initFloorData = {
          name: `Tầng ${i + 1}`,
          key: `F${i + 1}`,
          totalRoom: data.floors[i],
          availableRoom: 0,
          rentedRoom: 0,
          depositedRoom: 0,
          rooms: [],
        };

        let nCompletedRooms = 0;
        for (let j = 0; j < initFloorData.totalRoom; j++) {
          const roomKey = `00${j + 1}`.slice(-2);
          let initRoomData = {
            name: `${roomKey}`,
            key: `F${i + 1}-R${j + 1}`,
            // status: 'unknown',
            status: "available",
            price: initMotelRoomData.price,
            electricityPrice: initMotelRoomData.electricityPrice,
            waterPrice: initMotelRoomData.waterPrice,
            wifiPrice: initMotelRoomData.wifiPrice,
            garbagePrice: initMotelRoomData.garbagePrice,
            utilities: initMotelRoomData.utilities,
            acreage: data.roomAcreage,
            isCompleted: true,
            // Mã Khóa Phòng
            roomPassword: helpers.generateVerifyCode(),
            images: (await imageModel.find({ description: "room" })).map(
              (image) => image._id
            ),
          };

          const roomData = data.rooms.find((data1) => {
            return data1.roomKey === initRoomData.key;
          });

          if (roomData) {
            initRoomData["availableDate"] = new Date(roomData.availableDate);
            initRoomData["status"] = "available";
            initRoomData["isCompleted"] = true;
            initFloorData.availableRoom += 1;
          } else {
            if (rentedRoomMotel != 0) {
              if (depositedRoomRoomMotel != 0) {
                initRoomData["status"] = "deposited";
                depositedRoomRoomMotel--;
              } else {
                initRoomData["status"] = "rented";
                rentedRoomMotel--;
              }
            }
            // else {
            //     initRoomData['status'] = 'unknown';
            // }
          }

          const newRoomData = await roomModel.create(initRoomData);

          initFloorData.rooms.push(newRoomData._id.toString());
          if (newRoomData.status !== "unknown") {
            nCompletedRooms += 1;
          }
          // Set Phòng trống cho tầng
          initFloorData.availableRoom += 1;
        }

        if (nCompletedRooms === initFloorData.totalRoom) {
          initFloorData["isCompleted"] = true;
          nCompletedFloors += 1;
        }

        const newFloorData = await floorModel.create(initFloorData);
        initMotelRoomData.floors.push(newFloorData._id.toString());
      }

      initMotelRoomData.availableRoom =
        initMotelRoomData.totalRoom -
        initMotelRoomData.rentedRoom -
        initMotelRoomData.depositedRoom;

      data.owner = req["userId"];

      if (nCompletedFloors === initMotelRoomData.totalFloor) {
        initMotelRoomData["isCompleted"] = true;
      }

      let resData = await motelRoomModel.create(initMotelRoomData);

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      // Pass error to the next middleware

      next(e);
    }
  }

  /**
   * @swagger
   * /v1/homeKey/motelRoom/{id}:
   *   get:
   *     description: Return motel room by id
   *     tags: [MotelRoom]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         required:  true
   *         type:  string
   *         description: motel room id
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */

  static async getMotelRoomById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        floor: floorModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      let { id: motelRoomId } = req.params;
      console.log(117);

      const motelData = await MotelRoomController.getMotelRoom(motelRoomId);
      let availableRoom = 0;
      let rentedRoom = 0;
      let depositedRoom = 0;

      if (motelData && motelData.floors) {
        for (let index = 0; index < motelData.floors.length; index++) {
          const element = motelData.floors[index];
          let availableRoomFloors = 0;
          let rentedRoomFloors = 0;
          let depositedRoomFloors = 0;
          if (element.rooms) {
            for (let indexK = 0; indexK < element.rooms.length; indexK++) {
              const elementK = element.rooms[indexK];
              if (elementK.status === roomStatus.DEPOSITED) {
                depositedRoomFloors++;
              } else if (
                elementK.status === roomStatus.AVAILABLE ||
                elementK.status === roomStatus.UNKNOWN
              ) {
                availableRoomFloors++;
              } else {
                rentedRoomFloors++;
              }
            }
            // update floors
            await floorModel
              .findOneAndUpdate(
                { _id: element._id },
                {
                  rentedRoom: rentedRoomFloors,
                  availableRoom: availableRoomFloors,
                  depositedRoom: depositedRoomFloors,
                },
                { new: true }
              )
              .exec();
            availableRoom = availableRoom + availableRoomFloors;
            rentedRoom = rentedRoom + rentedRoomFloors;
            depositedRoom = depositedRoom + depositedRoomFloors;
          }
        }
        // update mptel
        await motelRoomModel
          .findOneAndUpdate(
            { _id: motelData._id },
            {
              rentedRoom: rentedRoom,
              availableRoom: availableRoom,
              depositedRoom: depositedRoom,
            }
          )
          .exec();
      }
      return HttpResponse.returnSuccessResponse(
        res,
        await MotelRoomController.getMotelRoom(motelRoomId)
      );
    } catch (e) {
      next(e);
    }
  }

  static async getMotelRoomVisualDataById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        floor: floorModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      let { id: motelRoomId } = req.params;

      const motelData = await motelRoomModel.findOne({_id: motelRoomId}).lean().exec();

      if(!motelData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tòa nhà không tồn tại"
        )
      }

      if(!motelData.floors) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Tòa nhà không có tầng nào"
        )
      }
      let floorData = [];
      const floors = motelData.floors;
      for(let i = 0; i<floors.length; i ++) {
        let floor = await floorModel.findOne({_id: floors[i]}).populate("rooms").lean().exec();
        if(floor) {
          floorData.push(floor);
        }
      }

      // motelData.floors = floorData;

      return HttpResponse.returnSuccessResponse(res, floorData);
    } catch (e) {
      next(e);
    }
  }

  static async getMotelRoomByIdAndFloor(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        floor: floorModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      let { id: motelRoomId, floor } = req.params;
      const indexFloor : number = parseInt(floor);
      console.log({floor});

      const motelData = await motelRoomModel.findOne({_id: motelRoomId}).lean().exec();
      if(!motelData) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      if(!motelData.floors) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      if(motelData.floors.length === 0) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      if(motelData.floors.length < (indexFloor + 1)) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      const floorData = await floorModel.findOne({_id: motelData.floors[indexFloor]}).populate("rooms").lean().exec();

      if(!floorData) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      if(!floorData.rooms) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      if(floorData.rooms.length === 0) {
        return HttpResponse.returnSuccessResponse(res, []);
      }

      return HttpResponse.returnSuccessResponse(res, floorData.rooms);
    } catch (e) {
      next(e);
    }
  }

  static async getMotelRoomByIdV2(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        floor: floorModel,
        motelRoom: motelRoomModel,
        image: imageModel,
      } = global.mongoModel;
      let { id: motelRoomId } = req.params;

      const motelRoomData = await motelRoomModel.findOne({_id: motelRoomId}).populate("address").lean().exec();

      if(motelRoomData) {
        if (motelRoomData.images && (motelRoomData.images.length > 0)) {
          let images = [];
          for(let i = 0; i < motelRoomData.images.length; i++) {
            const dataimg = await imageModel.findOne({
              _id: motelRoomData.images[i],
            });
            if (dataimg) {
              images.push(await helpers.getImageUrl(dataimg));
            } 
          }
          motelRoomData.images = images;
        }
      }

      console.log({motelRoomData});
      return HttpResponse.returnSuccessResponse(res, motelRoomData);
    } catch (e) {
      next(e);
    }
  }

  static async getMotelRoomByIdDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        room: roomModel,
        motelRoom: motelRoomModel,
        floor: floorModel,
        job: jobModel,
        user: userModel,
      } = global.mongoModel;
      let { id: motelRoomId, idroom } = req.params;
      let { startDate, endDate } = req.query;
      const jobData = await jobModel
        .find({
          room: idroom,
          isCompleted: true,
          checkInTime: {
            $gte: new Date(startDate.toString()), // lớn hơn
            $lt: new Date(endDate.toString()), // nhỏ hơn
          },
        })
        .populate("room orders currentOrder")
        .lean()
        .exec();
      if (jobData) {
        for (let i = 0; i < jobData.length; i++) {
          const user = jobData[i].user;
          let userData = await userModel
            .findOne(
              { _id: user, isDeleted: false },
              { password: 0, token: 0, role: 0 }
            )
            .lean()
            .exec();
          if (userData) {
            jobData[i].user = userData;
          }
        }
      }

      return HttpResponse.returnSuccessResponse(res, jobData);
    } catch (e) {
      next(e);
    }
  }
  static async getMotelRoomByIdRoom(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        room: roomModel,
        motelRoom: motelRoomModel,
        floor: floorModel,
        job: jobModel,
        user: userModel,
        image: imageModel,
      } = global.mongoModel;
      let { id: motelRoomId, idroom, idUser } = req.params;
      const jobData = await jobModel
        .find({
          room: idroom,
          // user: idUser,
          isCompleted: true,
          // checkInTime: {
          //   $gte: new Date(startDate.toString()), // lớn hơn
          //   $lt: new Date(endDate.toString()), // nhỏ hơn
          // },
        })
        .populate("room orders currentOrder")
        .lean()
        .exec();
      const resData = [];
      if (jobData) {
        for (let i = 0; i < jobData.length; i++) {
          const user = jobData[i].user;
          if (user == idUser) {
            let userData = await userModel
              .findOne(
                { _id: user, isDeleted: false },
                { password: 0, token: 0, role: 0 }
              )
              .lean()
              .exec();
            if (userData) {
              jobData[i].user = userData;
            }
            // get motelRoom
            let motelRoomData = await motelRoomModel
              .findOne({ _id: motelRoomId })
              .populate("floors")
              .lean()
              .exec();
            if (motelRoomData) {
              jobData[i].motelRoomData = motelRoomData;
              jobData[i].motelRoomData.emailOwner = "";
              let userDataOwner = await userModel
                .findOne(
                  { _id: jobData[i].motelRoomData.owner, isDeleted: false },
                  { password: 0, token: 0, role: 0 }
                )
                .lean()
                .exec();
              if (userDataOwner && userDataOwner.address) {
                jobData[i].motelRoomData.emailOwner = userDataOwner.address;
              }
            }
            //
            if (jobData[i].room) {
              const room = jobData[i].room;
              if (room) {
                if (room.images) {
                  if (room.images.length > 0) {
                    for (let j = 0; j < room.images.length; j++) {
                      const dataimg = await imageModel.findOne({
                        _id: room.images[j],
                      });
                      if (dataimg) {
                        jobData[i].room.images[j] = await helpers.getImageUrl(
                          dataimg
                        );
                      }
                    }
                  }
                }
              }
            }

            resData.push(jobData[i]);
            break;
          }
        }
      }

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/homeKey/motelRoom/{id}:
   *   put:
   *     description: Edit motelRoom by id
   *     tags: [MotelRoom]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         required:  true
   *         type:  string
   *         description: motel room id
   *       - name: contactPhone
   *         in: formData
   *         required: false
   *         type: string
   *         description: contactPhone
   *       - name: file
   *         in: formData
   *         required:  false
   *         type:  file
   *         description: image lists
   *       - name: minPrice
   *         in: formData
   *         required: false
   *         type: number
   *         description: minPrice
   *       - name: maxPrice
   *         in: formData
   *         required: false
   *         type: number
   *         description: maxPrice
   *       - name: electricityPrice
   *         in: formData
   *         required: false
   *         type: number
   *         description: electricityPrice
   *       - name: waterPrice
   *         in: formData
   *         required: false
   *         type: number
   *         description: waterPrice
   *       - name: description
   *         in: formData
   *         required: false
   *         type: string
   *         description: description
   *       - name: address
   *         in: formData
   *         required: false
   *         type: string
   *         description: address
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *          - auth: []
   */

  static async editMotelRoomById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        motelRoom: motelRoomModel,
        image: imageModel,
      } = global.mongoModel;

      let { id: motelRoomId } = req.params;

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

      return HttpResponse.returnSuccessResponse(
        res,
        await MotelRoomController.updateMotelRoom(motelRoomId, data)
      );
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/homeKey/motelRoom/{id}:
   *   delete:
   *     description: Return motel room by id
   *     tags: [MotelRoom]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         required:  true
   *         type:  string
   *         description: motel room id
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *          - auth: []
   */

  static async deleteMotelRoom(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      //Init model
      const {
        motelRoom: motelRoomModel,
        floor: floorModel,
        room: roomModel,
      } = global.mongoModel;

      let { id: motelRoomId } = req.params;

      const motelRoomData = await MotelRoomController.getMotelRoom(motelRoomId);

      if (!motelRoomData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "motelRoom.not.exist"
        );
      }

      if (motelRoomData.floors) {
        for (let i = 0; i < motelRoomData.floors.length; i++) {
          if (motelRoomData.floors[i].rooms) {
            for (let j = 0; j < motelRoomData.floors[i].rooms.length; j++) {
              if (
                ["rented", "deposited"].includes(
                  motelRoomData.floors[i].rooms[j].status
                )
              ) {
                return HttpResponse.returnBadRequestResponse(
                  res,
                  "floor.room.is.rented"
                );
              }
            }
          }
        }
      }

      return HttpResponse.returnSuccessResponse(
        res,
        await motelRoomModel
          .remove({ _id: motelRoomId })
          .lean()
          .exec()
      );
    } catch (e) {
      next(e);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            START HELPER FUNCTION                           */
  /* -------------------------------------------------------------------------- */

  // Get motel room by id Ơ
  static async getMotelRoom(motelRoomId: any): Promise<any> {
    const {
      motelRoom: motelRoomModel,
      image: imageModel,
      room: roomModel,
      job: jobModel,
      user: userModel,
    } = global.mongoModel;

    let motelRoomData = await motelRoomModel
      .findOne({ _id: motelRoomId })
      .populate([
        {
          path: "floors",
          populate: "rooms",
        },
      ])
      .populate("address images")
      .lean()
      .exec();
    if (motelRoomData.images) {
      motelRoomData.images = helpers.getImageUrl(motelRoomData.images, true);
    }

    motelRoomData = helpers.changeTimeZone(motelRoomData);
    for (let i = 0; i < motelRoomData.floors.length; i++) {
      const floorsList = motelRoomData.floors[i];
      for (let j = 0; j < floorsList.rooms.length; j++) {
        const roomsList = floorsList.rooms[j];

        const DataJob = await jobModel
          .findOne({ room: roomsList._id })
          .populate("room orders images")
          .lean()
          .exec();
        if (DataJob) {
          if (DataJob.user) {
            const userData = await userModel
              .findOne(
                { _id: DataJob.user, isDeleted: false },
                { password: 0, token: 0 }
              )
              .populate("avatar identityCards backId frontId")
              .lean()
              .exec();
            // User avatar
            if (userData.avatar) {
              userData.avatar = await helpers.getImageUrl(userData.avatar);
            }
            // User backId
            if (userData.backId) {
              userData.backId = await helpers.getImageUrl(userData.backId);
            }

            // User frontId
            if (userData.frontId) {
              userData.frontId = await helpers.getImageUrl(userData.frontId);
            }
            DataJob.user = userData;
          }
        }

        const imageArr = [];
        for (let k = 0; k < roomsList.images.length; k++) {
          const dataimg = await imageModel.findOne({
            _id: roomsList.images[k],
          });
          if (dataimg) {
            imageArr.push(await helpers.getImageUrl(dataimg));
          }
        }
        motelRoomData.floors[i].rooms[j].images = imageArr;
        motelRoomData.floors[i].rooms[j].jobs = DataJob;
      }
    }

    return motelRoomData;
  }

  // Update motel room by id
  // static async updateMotelRoom(motelRoomId: any, rawData: any, idImg: any): Promise<any>
  static async updateMotelRoom(motelRoomId: any, rawData: any): Promise<any> {
    let data = rawData.formData;
    if (!data.address.address) {
      const googleMap = new GoogleMapService();
      const googleMapData = await googleMap.getAddressDetail(data.address);
      const addressData = await AddressController.createAddress(
        googleMapData.results[0]
      );
      data["address"] = addressData._id;
    }

    const { motelRoom: motelRoomModel } = global.mongoModel;

    data["minPrice"] = parseInt(data.minPrice);
    data["maxPrice"] = parseInt(data.maxPrice);
    data["price"] = (data.minPrice + data.maxPrice) / 2;

    // Find data of user
    return await motelRoomModel
      .findOneAndUpdate({ _id: motelRoomId }, data, { new: true })
      .populate([
        {
          path: "floors",
          populate: "rooms",
        },
      ])
      .populate("address")
      .lean()
      .exec();
  }

  // // Post search Find MotelRoom from Address
  static async postSearchMortelRoom(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const data = req.params.key;

      const {
        address: addressModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;

      const datares = await addressModel.aggregate([
        {
          $search: {
            index: "address",
            text: {
              query: data,
              path: {
                wildcard: "*",
              },
            },
          },
        },
      ]);

      const arrAddresses = [];
      datares.forEach((element) => {
        arrAddresses.push(element._id);
      });

      let resArrData = [];

      if (arrAddresses.length < 0) {
        return HttpResponse.returnBadRequestResponse(res, "Không có phòng nào");
      } else {
        for (let i = 0; i < arrAddresses.length; i++) {
          const motelRoomData = await motelRoomModel
            .findOne({ address: arrAddresses[i] })
            .populate("address")
            .populate("images")
            .lean()
            .exec();
          if (motelRoomData) {
            const image = helpers.getImageUrl(motelRoomData.images, true);
            motelRoomData.images = image;
            resArrData.push(motelRoomData);
          }
        }
      }
      return HttpResponse.returnSuccessResponse(res, resArrData);
    } catch (e) {
      next(e);
    }
  }

  static async postExportPdf(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    console.log("ĐÃ TẢI XONG HÓA ĐƠN")
    try {
      const { banking: BankingModel, image: imageModel } = global.mongoModel;
      const data = [];
      const nameFile = "Thien";
      let fileName = `${nameFile}.pdf`;
      const json = req.body;
      console.log("json", json);
      // insert db
      const ress = await BillController.insertDb(json, req["userId"]);

      console.log("ress", ress)
      if (ress && ress.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Mã Hóa Đơn Đã Tồn Tại"
        );
      }

      let resData = await BankingModel.find()
        .populate("images")
        .lean()
        .exec();
      if (resData.length <= 0) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Chưa Có Tài Khoản Nhận Tiền Liên Hệ Admin"
        );
      }

      console.log("resData[0]", resData[0]);
      const buffer = await generatePDF(json, resData[0]);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Dispsition", "attachment;filename=" + fileName);

      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }

  static async postExportPdfById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const { banking: BankingModel, image: imageModel } = global.mongoModel;
      const nameFile = "Thien";
      let fileName = `${nameFile}.pdf`;
      let json = req.body;
      let { id: idBill } = req.params;
      const dataBill = await BillController.getBillById(idBill);

      if (!dataBill) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Mã Hóa Đơn Đã Tồn Tại"
        );
      }
      console.log(dataBill.user);
      json = dataBill;

      json.expenseRoom = dataBill.room.expense;
      json.typeRoom = dataBill.room.type;
      json.unitPriceRoom = dataBill.room.unitPrice;
      json.totalRoom = dataBill.room.total;

      json.expenseRoom = dataBill.room.expense;
      json.typeRoom = dataBill.room.type;
      json.unitPriceRoom = dataBill.room.unitPrice;
      json.totalRoom = dataBill.room.total;

      json.expenseElectricity = dataBill.electricity.expense;
      json.typeElectricity = dataBill.electricity.type;
      json.unitPriceElectricity = dataBill.electricity.unitPrice;
      json.totalElectricity = dataBill.electricity.total;

      json.expenseWater = dataBill.water.expense;
      json.typeWater = dataBill.water.type;
      json.unitPriceWater = dataBill.water.unitPrice;
      json.totalWater = dataBill.water.total;

      json.expenseGarbage = dataBill.garbage.expense;
      json.typeGarbage = dataBill.garbage.type;
      json.unitPriceGarbage = dataBill.garbage.unitPrice;
      json.totalGarbage = dataBill.garbage.total;

      json.expenseWifi = dataBill.wifi.expense;
      json.typeWifi = dataBill.wifi.type;
      json.unitPriceWifi = dataBill.wifi.unitPrice;
      json.totalWifi = dataBill.wifi.total;

      json.expenseOther = dataBill.other.expense;
      json.typeOther = dataBill.other.type;
      json.unitPriceOther = dataBill.other.unitPrice;
      json.totalOther = dataBill.other.total;

      let resData = await BankingModel.find()
        .populate("images")
        .lean()
        .exec();
      if (resData.length <= 0) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Chưa Có Tài Khoản Nhận Tiền Liên Hệ Admin"
        );
      }
      const buffer = await generatePDF(json, resData[0]);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Dispsition", "attachment;filename=" + fileName);
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/homeKey/room/{id}/img:
   *   get:
   *     description: Return job by roomid
   *     tags: [Room]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         type: string
   *         description: room id
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *          - auth: []
   */

  static async postUploadImgByRoomId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      //Init models
      const {
        motelRoom: motelRoomModel,
        image: imageModel,
      } = global.mongoModel;

      let { id: motelRoomId } = req.params;

      const imageService = new ImageService("local", false);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }

      const { body: data } = req;

      // Upload image
      if (req["files"]) {
        const uploadResults = await imageService.upload(req["files"].file);
        if (uploadResults.error) {
          return HttpResponse.returnInternalServerResponseWithMessage(
            res,
            uploadResults.message
          );
        }
        const imageArr = [];
        imageArr.push(uploadResults.imageId);
        // data.images.imageUrl = uploadResults.imageUrl;
        // data.images.imageId = uploadResults.imageId;
        const resData = await motelRoomModel
          .findOneAndUpdate(
            { _id: motelRoomId },
            // {
            //   images: imageArr,
            // },
            {
              $addToSet: {
                images: uploadResults.imageId
              },
            },
            {
              new: true,
            }
          )
          .populate("images")
          .lean()
          .exec();
      }

      return HttpResponse.returnSuccessResponse(res, data);
    } catch (e) {
      next(e);
    }
  }

  static async postUploadImgsByRoomId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      //Init models
      const { room: roomModel } = global.mongoModel;

      let { id: roomId } = req.params;

      const imageService = new ImageService("local", false);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }

      let resDataOld = await roomModel
        .findOne({ _id: roomId })
        .populate("images")
        .lean()
        .exec();

      if (!resDataOld) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Phòng không tồn tại"
        );
      }
      let resData = resDataOld;
      // Upload image
      if (req["files"]) {
        console.log("fillleeee", req["files"]);
        const uploadResults = await imageService.upload(req["files"].file);
        if (uploadResults.error) {
          return HttpResponse.returnInternalServerResponseWithMessage(
            res,
            uploadResults.message
          );
        }

        console.log({uploadResults});

        const dataIMG = resDataOld.images || [];
        dataIMG.push(uploadResults.imageId);
        console.log({dataIMG});

        resData = await roomModel
          .findOneAndUpdate(
            { _id: roomId },
            // {
            //   images: dataIMG,
            // },
            {
              $addToSet: {
                images: uploadResults.imageId
              },
            },
            {
              new: true,
            }
          )
          .populate("images")
          .lean()
          .exec();
      }

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  //note
  static async getBuildingListByHost(req: Request, res: Response, next: NextFunction): Promise<any> {
    const id = req.params.id;
    console.log("id", id);
    console.log("-------------------------------------------");

    const { motelRoom: motelRoomModel, address: addressModel } = global.mongoModel;

    try {
      const resData = await motelRoomModel
        .find({ owner: id })
        // .populate("address")
        .lean()
        .exec();

      console.log("resDataaa: ", resData);

      const formattedData = await Promise.all(resData.map(async (element) => {
        console.log("element", element);

        const addressId = mongoose.Types.ObjectId(element.address);
        const addressData = await addressModel.findOne({ _id: element.address }).lean().exec();
        if (addressData) {
          console.log("check doc: ", element)
          return {
            ...element,
            addressName: addressData.address,

          }
        }

        return {
          ...element._doc,
          addressName: ''
        };
      }));
      console.log("formattedData", formattedData);

      return HttpResponse.returnSuccessResponse(res, formattedData);
    } catch (e) {
      next(e);
    }
  }




  /* -------------------------------------------------------------------------- */
  /*                             END HELPER FUNCTION                            */
  /* -------------------------------------------------------------------------- */

}
async function generatePDF(json, banking) {
  console.log("banking", banking);

  return new Promise((resolve, reject) => {
    let fontpathnormal = __dirname + "/fonts/roboto/Roboto-Regular.ttf";
    let fontpathbold = __dirname + "/fonts/roboto/Roboto-Medium.ttf";
    let fontpathitalics = __dirname + "/fonts/roboto/Roboto-Italic.ttf";
    let fontpathbolditalics =
      __dirname + "/fonts/roboto/Roboto-MediumItalic.ttf";
    var fonts = {
      Roboto: {
        normal: fontpathnormal,
        bold: fontpathbold,
        italics: fontpathitalics,
        bolditalics: fontpathbolditalics,
      },
    };
    const parsedDate = moment(json.dateBill, "DD/MM/YYYY");
    const month = parsedDate.format("MM");
    const year = parsedDate.format("YYYY");
    const lastDayOfMonth = parsedDate.endOf("month").format("DD");
    var docDefinition = {
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          text: `HÓA ĐƠN THÁNG ${month}`,
          style: "header",
          alignment: "center",
        },
        {
          alignment: "justify",
          style: "margin10",
          columns: [
            {
              text: [
                {
                  text: `KHÁCH SẠN ${json.nameMotel}\n`,
                  fontSize: 15,
                  bold: true,
                  color: "red",
                },
                {
                  text: `Tên khách hàng: ${json.nameUser}\n`,
                },
                {
                  text: `Số điện thoại khách hàng: ${json.phoneUser}\n`,
                },
                {
                  text: `Địa chỉ: ${json.address}`,
                },
              ],
            },
            {
              alignment: "right",
              text: [
                {
                  text: `Phòng ${json.nameRoom}\n`,
                  fontSize: 12,
                  bold: true,
                  color: "red",
                },
                {
                  text: `Mã Hóa Đơn ${json.idBill}\n`,
                },
                {
                  text: `Ngày ${json.dateBill}\n`,
                },
              ],
            },
          ],
        },
        {
          text:
            "................................................................................",
          alignment: "center",
        },
        {
          style: "tableExample",
          alignment: "center",
          table: {
            widths: [159, 100, "*", "*"],
            body: [
              [
                {
                  text: "Mục",
                  bold: true,
                  alignment: "left",
                },
                {
                  text: "Số ngày/Đơn vị",
                  bold: true,
                },
                {
                  text: "Đơn Giá",
                  bold: true,
                },
                {
                  text: "Thành Tiền",
                  bold: true,
                },
              ],
              [
                {
                  text: `${json.expenseRoom}`,
                  alignment: "left",
                },
                {
                  text: `${json.typeRoom}`,
                },
                {
                  text: `${json.unitPriceRoom} đ`,
                },
                {
                  text: `${json.totalRoom} đ`,
                },
              ],
              [
                {
                  text: `${json.expenseElectricity}`,
                  alignment: "left",
                },
                {
                  text: `${json.typeElectricity}`,
                },
                {
                  text: `${json.unitPriceElectricity} đ`,
                },
                {
                  text: `${json.totalElectricity} đ`,
                },
              ],
              [
                {
                  text: `${json.expenseWater}`,
                  alignment: "left",
                },
                {
                  text: `${json.typeWater}`,
                },
                {
                  text: `${json.unitPriceWater} đ`,
                },
                {
                  text: `${json.totalWater} đ`,
                },
              ],
              [
                {
                  text: `${json.expenseWifi}`,
                  alignment: "left",
                },
                {
                  text: `${json.typeWifi}`,
                },
                {
                  text: `${json.unitPriceWifi} đ`,
                },
                {
                  text: `${json.totalWifi} đ`,
                },
              ],
              [
                {
                  text: `${json.expenseGarbage}`,
                  alignment: "left",
                },
                {
                  text: `${json.typeGarbage}`,
                },
                {
                  text: `${json.unitPriceGarbage} đ`,
                },
                {
                  text: `${json.totalGarbage} đ`,
                },
              ],
              [
                {
                  text: `${json.expenseOther}`,
                  alignment: "left",
                },
                {
                  text: `${json.typeOther}`,
                },
                {
                  text: `${json.unitPriceOther}`,
                },
                {
                  text: `${json.totalOther}`,
                },
              ],
              [
                {
                  text: "",
                  alignment: "left",
                },
                {
                  text: "",
                },
                {
                  text: "Tổng cộng:",
                  fontSize: 12,
                  bold: true,
                },
                {
                  text: `${json.totalAll} đ`,
                },
              ],
              [
                {
                  text: "",
                  alignment: "left",
                },
                {
                  text: "",
                },
                {
                  text: `Thuế (${json.typeTaxAll})):`,
                  fontSize: 12,
                  bold: true,
                },
                {
                  text: `${json.totalTaxAll} đ`,
                },
              ],
              [
                {
                  text: "",
                  alignment: "left",
                },
                {
                  text: "",
                },
                {
                  text: `TỔNG TIỀN:`,
                  fontSize: 12,
                  bold: true,
                },
                {
                  text: `${json.totalAndTaxAll} đ`,
                },
              ],
            ],
          },
          layout: "noBorders",
        },

        {
          text:
            "................................................................................",
          alignment: "center",
        },
        {
          alignment: "justify",
          style: "margin10",
          columns: [
            {
              text: [
                {
                  text: "Thông tin thanh toán\n",
                  fontSize: 15,
                  bold: true,
                  color: "red",
                },
                {
                  text: `${banking.nameTkLable}\n`,
                },
                {
                  text: `Tên Tài Khoản: ${banking.nameTk}\n`,
                },
                {
                  text: `Số tài khoản: ${banking.stk}\n`,
                },
                {
                  text: `Hạn thanh toán: ${lastDayOfMonth}/${month}/${year}`,
                },
              ],
            },
          ],
        },
        {
          alignment: "justify",
          style: "margin10",
          columns: [
            {
              text: [
                {
                  text: "Thông tin liên hệ\n",
                  fontSize: 15,
                  bold: true,
                  color: "red",
                },
                {
                  text: `Email: ${json.emailOwner}\n`,
                },
                {
                  text: `Địa chỉ: ${json.address}\n`,
                },
                {
                  text: `Số điện thoại: ${json.phoneUser}\n`,
                },
              ],
            },
          ],
        },
      ],
      styles: {
        header: {
          fontSize: 30,
          bold: true,
          alignment: "justify",
        },
        margin10: {
          margin: [10, 10, 10, 10],
        },
        tableExample: {
          margin: [0, 5, 0, 15],
        },
      },
    };

    let printer = new PdfPrinter(fonts);
    let pdfDoc = printer.createPdfKitDocument(docDefinition);
    // buffer the output
    let chunks = [];
    pdfDoc.on("data", (chunk: any) => {
      chunks.push(chunk);
    });
    pdfDoc.on("end", () => {
      var result = Buffer.concat(chunks);
      resolve(result);
    });
    pdfDoc.on("error", (error) => {
      reject(error);
    });
    // close the stream
    pdfDoc.end();
  });
}
