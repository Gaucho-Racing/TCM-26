#ifndef _SM700_H_
#define _SM700_H_

#include <stdint.h>

#define SM7000_I2C_ADDR 0x6C<<1
#define SM7000_I2C_ADDR_CRC 0x6D<<1

#define CRC4_poly 0x03
#define CRC8_ploy 0xD4

#define CRC4_ini 0x0F
#define CRC8_ini 0xFF

#define CMD 0x22
#define DSP_T 0x2E
#define DSP_S 0x30
#define STATUS_SYNC 0x32
#define STATUS 0x36

#define SER0 0x50
#define SER1 0x51

uint8_t SM7000_Reset();
uint8_t SM7000_Sleep();
uint8_t SM7000_ReadTemp(uint16_t *data);
uint8_t SM7000_ReadPressure(uint16_t *data);
uint8_t SM7000_ReadStatus_Sync(uint16_t *data);
uint8_t SM7000_ReadStatus(uint16_t *data);
uint8_t SM7000_ReadSerial(uint32_t *data);


#endif