import { API } from 'homebridge';

import { ACCESSORY_NAME } from './settings';
import { SwitchbotCurtainAccessory } from './SwitchbotCurtainAccessory'; 

export = (api: API) => {
  api.registerAccessory(ACCESSORY_NAME, SwitchbotCurtainAccessory);
};
