package utils

import (
	crand "crypto/rand"
	"encoding/binary"
	"log"
	"math/rand"
	"os"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func GetEnvironment() string {
	return GoDotEnvVariable("APP_ENV")
}

func GetApiKey() string {
	return GoDotEnvVariable("NOLONGR_SERVER_API_KEY")
}

func GoDotEnvVariable(key string) string {
	err := godotenv.Load(".env")
	if err != nil {
		log.Printf("Error loading .env file")
	}
	return os.Getenv(key)
}

const PRODUCTION_SITE_URL = "https://nolongr.vercel.app"
const DEV_SITE_URL = "http://localhost:3000"

func GetBaseUrl() string {
	if GetEnvironment() == "production" {
		return PRODUCTION_SITE_URL
	} else {
		return DEV_SITE_URL
	}
}

//const FIREBASEPROJECTID = "nolongr-xurifyteine"

type cryptoSource struct{}

func (source cryptoSource) Seed(seed int64) {}

func (source cryptoSource) Uint64() (value uint64) {
	err := binary.Read(crand.Reader, binary.BigEndian, &value)
	if err != nil {
		log.Print(err)
	}
	return value
}

func (source cryptoSource) Int63() int64 {
	return int64(source.Uint64() & ^uint64(1<<63))
}

func RandomInt64(maxInteger int64) int64 {
	var source cryptoSource
	randomNumber := rand.New(source)
	return randomNumber.Int63n(maxInteger)
}

var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12345678910-_~")

func randomSequence(length int) string {
	b := make([]rune, length)
	for i := range b {
		b[i] = letters[RandomInt64(int64(len(letters)))]
	}
	return string(b)
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
