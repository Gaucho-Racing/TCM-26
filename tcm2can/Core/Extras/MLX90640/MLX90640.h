#ifndef __MLX90640_H__
#define __MLX90640_H__

#include <stdint.h>


/*
To do temperature calculation:
1. Read EEPROM
2. Supply voltage calculation 
3. Ambient temperature calculation
4. Gain compensation 
5. IR data compenstation - offset, VDD, Ta
6. IR data emmissivity compensation
7. IR data gradient compensation
8. Normalizing to sensitivity 
9. Calculation To
10. Image processing 
*/

#define MLX90640_ADDRESS 0x33 << 1

//registers
#define STATUS 0x8000
#define CNTRLREG1 0x800D
#define I2CREG 0x800F

//eegrom 
#define EESTART 0x2400
#define EEEND 0x273F
#define EESIZE 832

//RAM 
#define RAMSTART 0x0400
#define RAMEND 0x07FF

//ROM 
#define ROMSTART 0x0000
#define ROMEND 0x03FF

//extra defines 


//control register 1
#define CNTRLREG1_EE 0x240C
#define EnableSubMode 0x1
#define EnableDataHold 0x4
#define EnableSubPageRepeat 0x8
#define SubPage_0 0x0
#define SubPage_1 0x1
#define RR_Mask 0x0F
#define HalfHz 0x00
#define OneHz 0x01
#define TwoHz 0x02
#define FourHz 0x03
#define EightHz 0x04
#define SixteenHz 0x05
#define ThirtyTwoHz 0x06
#define SixtyFourHz 0x07
#define ADC_16bit 0x0
#define ADC_17bit 0x1
#define ADC_18bit 0x2
#define ADC_19bit 0x3
#define InterleavedMode 0x0
#define ChessMode 0x1


struct MLX90640 {
    uint16_t eeprom[EEEND - EESTART + 1]; 
    uint16_t ram[RAMEND - RAMSTART + 1];   
};

uint8_t extractEEPROM(struct MLX90640 *mlx);
uint8_t setRefreshRate(struct MLX90640 *mlx, uint8_t rate);
uint8_t setInterleavedMode(struct MLX90640 *mlx);
uint8_t setChessMode(struct MLX90640 *mlx);
uint8_t readFrameData(struct MLX90640 *mlx);




#endif