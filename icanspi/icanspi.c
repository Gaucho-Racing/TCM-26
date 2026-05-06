#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <jetgpio.h>
#include <signal.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <time.h>
#include "circularBuffer.h"

// Comment out to disable interrupt debug output
// #define DEBUG

// Comment out to disable UDP debug output
// #define UDP_DEBUG

#ifdef DEBUG
#define DBG_PRINT(fmt, ...) printf("[DEBUG] " fmt, ##__VA_ARGS__)
#define DBG_EPOCH_US() get_epoch_us()
static long long get_epoch_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (long long)ts.tv_sec * 1000000LL + ts.tv_nsec / 1000;
}
#else
#define DBG_PRINT(fmt, ...) do {} while(0)
#define DBG_EPOCH_US() 0LL
#endif

#ifdef UDP_DEBUG
#define UDP_DBG_PRINT(fmt, ...) printf("[UDP_DEBUG] " fmt, ##__VA_ARGS__)
#define UDP_PRINT(fmt, ...) printf(" " fmt, ##__VA_ARGS__)
#else
#define UDP_DBG_PRINT(fmt, ...) do {} while(0)
#define UDP_PRINT(fmt, ...) do {} while(0)
#endif

static volatile int interrupt = 1;
long unsigned int timestamp;
volatile int temp = 0;
int SPI_init;
CircularBuffer *cb = NULL;

struct CAN{
    union{
      uint16_t buffer[36];
      struct{
        uint32_t ID;
        uint8_t bus;
        uint8_t length;
        uint8_t data[64];
      }split;
    }combined;
  };

void inthandler(int signum)
{
  usleep(1000);
  printf("\nCaught Ctrl-c, coming out ...\n");
  interrupt = 0;
}

int startSPI(int port, int speed, int mode, int lsb){
    int SPI_init;
    SPI_init = spiOpen(port, speed, mode, 0, 8, lsb, 1);
    if (SPI_init < 0)
    {
        printf("Port SPI2 opening failed. Error code:  %d\n", SPI_init);
        exit(1);
    }
    else
    {
        printf("Port SPI2 opened OK. Return code:  %d\n", SPI_init);
    }
    return SPI_init;
}

int spiTransfer(int handle, uint8_t *txBuf, uint8_t *rxBuf, unsigned len){
    int SPI_stat;
    SPI_stat = spiXfer(handle, (char *)txBuf, (char *)rxBuf, len);
    if (SPI_stat < 0)
    {
        printf("SPI transfer failed. Error code:  %d\n", SPI_stat);
        exit(1);
    }
    else
    {
        printf("SPI transfer OK. Return code:  %d\n", SPI_stat);
    }
    return SPI_stat;
}

int enableGPIO(int pin, int mode){
    int stat = gpioSetMode(pin, mode);
    if (stat < 0)
    {
        printf("GPIO setting up failed. Error code:  %d\n", stat);
        exit(1);
    }
    else
    {
        printf("GPIO setting up OK. Return code:  %d\n", stat);
    }
    return stat;
}

int setCB(int pin, int edge, int delay, long unsigned int *timestamp, void *calling){
    int stat2 = gpioSetISRFunc(pin, edge, delay, timestamp, calling);
    if (stat2 < 0)
    {
        printf("GPIO edge setting up failed. Error code:  %d\n", stat2);
        exit(1);
    }
    else
    {
        printf("GPIO edge setting up OK. Return code:  %d\n", stat2);
    }
    return stat2;
}

static uint32_t seq = 0;

void calling()
{
    long long isr_start = DBG_EPOCH_US();
    seq++;

    struct CAN frame = {0,};
    char tx[6] = {0,};
    char rx[6] = {0,};
    spiXfer(SPI_init, tx, rx, 6);

    // STM32 uses 16-bit SPI with MSB-first + LE memory → bytes are
    // swapped within each 16-bit halfword on the wire
    frame.combined.split.ID = (uint32_t)(rx[1]) |
                              ((uint32_t)(rx[0]) << 8) |
                              ((uint32_t)(rx[3]) << 16) |
                              ((uint32_t)(rx[2]) << 24);
    // bus is at struct offset 4, length at offset 5
    // but 16-bit SPI swaps them: rx[4]=length, rx[5]=bus
    frame.combined.split.bus = rx[5];
    char txTemp[64] = {0x69,};
    uint8_t length = (uint8_t)(rx[4]);

    if (length > 64) length = 64;
    frame.combined.split.length = length;

    spiXfer(SPI_init, txTemp, (char *)frame.combined.split.data, length + length%2);

    // Unswap bytes within each 16-bit halfword (SPI byte-swapped them)
    for (uint8_t i = 0; i < length + length%2; i += 2) {
        uint8_t tmp = frame.combined.split.data[i];
        frame.combined.split.data[i] = frame.combined.split.data[i+1];
        frame.combined.split.data[i+1] = tmp;
    }

    circularBufferPush(cb, frame.combined.buffer, sizeof(frame.combined.buffer));

    long long isr_end = DBG_EPOCH_US();
    DBG_PRINT("%05u  0x%08x  BUS=%2u  LEN=%3u  DATA=%02X %02X %02X %02X  BUF=%2u/%2u  DUR=%5lldus\n",
              seq, frame.combined.split.ID,
              frame.combined.split.bus, length,
              frame.combined.split.data[0],
              frame.combined.split.data[1],
              frame.combined.split.data[2],
              frame.combined.split.data[3],
              cb->size, cb->capacity,
              isr_end - isr_start);
}

int main(int argc, char *argv[])
{
    int Init;
    int status;
    uint32_t message_count = 0;
    cb = circular_buffer_init(64, 72);
    signal(SIGINT, inthandler);
    Init = gpioInitialise();
    uint32_t counter = 0;
    if (Init < 0)
    {
        printf("Jetgpio initialisation failed. Error code:  %d\n", Init);
        exit(Init);
    }
    else
    {
        printf("Jetgpio initialisation OK. Return code:  %d\n", Init);
    }
    SPI_init = startSPI(1, 12000000, 0, 0);
    status = enableGPIO(18, JET_INPUT);

    /*
    BK stuff
    */

    int sockfd;
    struct sockaddr_in servaddr;

    // Create UDP socket
    sockfd = socket(AF_INET, SOCK_DGRAM, 0);
    if (sockfd < 0) {
        perror("Socket creation failed");
        exit(1);
    }

    // Set server address
    memset(&servaddr, 0, sizeof(servaddr));
    servaddr.sin_family = AF_INET;
    servaddr.sin_port = htons(atoi("8000"));
    servaddr.sin_addr.s_addr = inet_addr("0.0.0.0");

    /*
    END BK stuff
    */

    //enable interupt after everything is good.
    status = setCB(18, FALLING_EDGE, 10, &timestamp, &calling);
    printf("%d\n", status);
    while(interrupt){
        struct CAN *frame = circularBufferPop(cb);
        if(frame != NULL){
            counter = 0;
            if (sendto(sockfd, frame, sizeof(struct CAN), 0, (const struct sockaddr *)&servaddr, sizeof(servaddr)) < 0) {
                perror("Send failed, message lost");
                continue;
            }
            uint8_t *raw = (uint8_t *)frame->combined.buffer;
            for(int i = 0; i < (int)sizeof(frame->combined.buffer); i++){
                UDP_PRINT("%02X ", raw[i]);
            }
            UDP_PRINT("\n");
        } else if(counter >= 2000){
            if (gpioRead(18) == 0){
                calling();
                DBG_PRINT("%05u  POLL  calling\n", seq);
            }
            counter = 0;
        } else {
            usleep(1);
            counter ++;
        }
    }
    spiClose(SPI_init);
    gpioTerminate();
    exit(0);
}
