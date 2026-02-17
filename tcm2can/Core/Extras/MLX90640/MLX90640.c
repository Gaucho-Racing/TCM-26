#include "MLX90640.h"
#include "MLX90640_driver.h"


uint8_t extractEEPROM(struct MLX90640 *mlx){
    return I2CRead(MLX90640_ADDRESS, EESTART, EEEND - EESTART + 1, (uint16_t *) mlx->eeprom);
}

uint8_t setRefreshRate(struct MLX90640 *mlx, uint8_t rate){
    uint8_t error;
    if(rate > 7 || rate < 0){
        return 1;
    }
    uint16_t controlRegister1;
    error = I2CRead(MLX90640_ADDRESS, CNTRLREG1, 1, &controlRegister1);
    if(error != 1){
        controlRegister1 = controlRegister1 & ~RR_Mask<<7 | rate<<7;
        error = I2CWrite(MLX90640_ADDRESS, CNTRLREG1, controlRegister1);
    }
    return error;
}
uint8_t setInterleavedMode(struct MLX90640 *mlx){
    uint16_t controlRegister1;

    int error;
    error = I2CRead(MLX90640_ADDRESS, CNTRLREG1, 1, &controlRegister1);
    if(error == 0){
        controlRegister1 = (controlRegister1 & (InterleavedMode << 11));
        error = I2CWrite(MLX90640_ADDRESS, CNTRLREG1, controlRegister1);
    }
    return error;
}

uint8_t setChessMode(struct MLX90640 *mlx){
    uint16_t controlRegister1;

    int error;
    error = I2CRead(MLX90640_ADDRESS, CNTRLREG1, 1, &controlRegister1);
    if(error == 0){
        controlRegister1 = (controlRegister1 & (InterleavedMode << 11) | (ChessMode << 11));
        error = I2CWrite(MLX90640_ADDRESS, CNTRLREG1, controlRegister1);
    }
    return error;
}