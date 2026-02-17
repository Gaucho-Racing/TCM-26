#ifndef _SM700_driver_H_
#define _SM700_driver_H_

#include <stdint.h>


extern uint8_t I2CRead(uint8_t slaveAddr,uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data);
extern uint8_t I2CWrite(uint8_t slaveAddr,uint16_t writeAddress, uint16_t data);

#endif