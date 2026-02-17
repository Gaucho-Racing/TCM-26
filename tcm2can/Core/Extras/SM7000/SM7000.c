#include "SM7000.h"
#include "SM700_driver.h"


uint8_t SM7000_Reset(){
    return I2CWrite(SM7000_I2C_ADDR, CMD, 0xB169);
}

uint8_t SM7000_Sleep(){
    return I2CWrite(SM7000_I2C_ADDR, CMD, 0x6C23);
}

uint8_t SM7000_ReadTemp(uint16_t *data){
    return I2CRead(SM7000_I2C_ADDR, DSP_T, 1, data);
}

uint8_t SM7000_ReadPressure(uint16_t *data){
    return I2CRead(SM7000_I2C_ADDR, DSP_S, 1, data);
}

uint8_t SM7000_ReadStatus_Sync(uint16_t *data){
    return I2CRead(SM7000_I2C_ADDR, STATUS_SYNC, 1, data);
}

uint8_t SM7000_ReadStatus(uint16_t *data){
    return I2CRead(SM7000_I2C_ADDR, STATUS, 1, data);
}

uint8_t SM7000_ReadSerial(uint32_t *data){
    
    return I2CRead(SM7000_I2C_ADDR, SER0, 2, (uint16_t *) data);


}