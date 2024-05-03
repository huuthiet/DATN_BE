import {default as job} from './job';
import {default as room} from './room';
import {default as electric} from './electric';
import {default as sendMailEnergy} from './sendMailEnergy';
import {default as autoChangeStatusRoom} from './autoChangeStatusRoom';

export default agenda => {
    console.log("Start AGENDA Job");
    return {
        job: job(agenda),
        room: room(agenda),
        electric: electric(agenda),
        sendMailEnergy: sendMailEnergy(agenda),
        autoChangeStatusRoom: autoChangeStatusRoom(agenda),
    }
}