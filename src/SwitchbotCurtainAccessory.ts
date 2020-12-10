import { Service, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, CharacteristicEventTypes} from 'hap-nodejs';
import {AccessoryPlugin, API} from "homebridge/lib/api";
import {Logger} from "homebridge/lib/logger";
const Switchbot = require('node-switchbot');

export class SwitchbotCurtainAccessory implements AccessoryPlugin {
  private readonly log: Logger;
  private readonly config;
  private readonly api: API;

  private informationService: Service;
  private windowCoverService: Service;

  private switchbot: typeof Switchbot;
  private device : any;
  private id = '';
  private name = '';
  private manufacturer = '';
  private model = '';

  private positionState;
  private position : number;

  constructor(log: Logger, config: any, api: API) {

    this.log = log;
    this.config = config;
    this.api = api;
    this.position = 0;

    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    this.positionState = Characteristic.PositionState.STOPPED;

    // parse config
    this.name = config.name;
    this.manufacturer = config.manufacturer || "Wonderlabs, Inc.";
    this.model = config.model || "W1001000";
    this.id = config.id;

    this.informationService = new Service.AccessoryInformation();
    this.windowCoverService = new Service.WindowCovering(this.name, 'windowCoverService');

    this.switchbot = new Switchbot();

    this.switchbot.discover({ model: 'c', quick: true, id: this.id})
      .then((devices: any) => {
        this.device = devices[0];
        this._getCurrentPosition()
          .then((position) => {
            this.position = 100 - position;
          });

        this.log.info("Found device: " + this.device);

        // set accessory information
        this.informationService
          .setCharacteristic(Characteristic.Name, this.name)
          .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
          .setCharacteristic(Characteristic.SerialNumber, this.id)
          .setCharacteristic(Characteristic.Model, this.model);


        this.windowCoverService.getCharacteristic(Characteristic.TargetPosition)
          .on(CharacteristicEventTypes.SET, this.setTargetPosition.bind(this))                // SET - bind to the `setOn` method below
          .on(CharacteristicEventTypes.GET, this.getCurrentPosition.bind(this));               // GET - bind to the `getOn` method below

        this.windowCoverService.getCharacteristic(Characteristic.CurrentPosition)
          .on(CharacteristicEventTypes.GET, this.getCurrentPosition.bind(this));

        this.windowCoverService.getCharacteristic(Characteristic.PositionState)
          .on(CharacteristicEventTypes.GET, this.getPositionState.bind(this));
      })
  }

  getServices(): Service[] {
    return [this.informationService, this.windowCoverService];
  }

  _getCurrentPosition() {
    return new Promise<number>((resolve, reject) => {
      this.switchbot.onadvertisement = (ad : any) => {
        this.switchbot.stopScan();
        resolve(parseInt(ad.serviceData.position));
      };

      this.switchbot.startScan({ id: this.id })
        .then( () => {
          return this.switchbot.wait(1000);
        })
        .catch( (error : any) => {
          reject(error);
        });
    });
  }

  setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    this.log.info("Called setTargetPosition()");

    this.log.info('Set position ' + this.position + ' to ' + value);

    if (this.position > value) {
      this.positionState = Characteristic.PositionState.DECREASING;
      this.log.info('Set position state to DECREASING.');
    } else if (this.position < value ) {
      this.positionState = Characteristic.PositionState.INCREASING;
      this.log.info('Set position state to INCREASING.');
    } else {
      return;
    }

    this.windowCoverService.setCharacteristic(Characteristic.PositionState, this.positionState);

    this.device.runToPos(100 - Number(value))
      .then(() => {
        this.positionState = Characteristic.PositionState.STOPPED;
        this.windowCoverService.setCharacteristic(Characteristic.PositionState, this.positionState);
        this.log.info('Moved ' + this.position + ' to ' + value);
        this.position = Number(value);
        callback();
      })
      .catch((error : any) => {
        this.positionState = Characteristic.PositionState.STOPPED;
        this.windowCoverService.setCharacteristic(Characteristic.PositionState, this.positionState);
        this.log.info('Error occured.');
        callback(error);
      });
  }

  getCurrentPosition(callback: CharacteristicGetCallback) {
    callback(undefined, this.position);
  }

  getPositionState(callback: CharacteristicGetCallback) {
    this.log.info('Position state is ' + this.positionState );
    callback(undefined, this.positionState);
  }

}
