#ifndef __MLX90640_DRIVER_H__
#define __MLX90640_DRIVER_H__

#include <stdint.h>

extern uint8_t I2CRead(uint8_t slaveAddr,uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data);
extern uint8_t I2CWrite(uint8_t slaveAddr,uint16_t writeAddress, uint16_t data);

#endif