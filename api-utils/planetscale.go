package utils

import (
	"bufio"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"time"

	"database/sql"

	_ "github.com/go-sql-driver/mysql"
)

func getNewPlanetScaleClient() (*sql.DB, error) {
	// Open a connection to the database
	db, err := sql.Open("mysql", GoDotEnvVariable("DSN"))
	if err != nil {
		log.Print("(getNewPlanetScaleClient) failed to open db connection", err)
	}

	return db, err
}

type URLData struct {
	Destination  string         `json:"destination"`
	ID           string         `json:"id"`
	DateCreated  string         `json:"date_created"`
	URL          string         `json:"url"`
	SelfDestruct string         `json:"self_destruct"`
	SessionToken string         `json:"session_token"`
	Password     sql.NullString `json:"password"`
}

func CreateUrl(url string, selfDestruct int64, sessionToken string, password string) (URLData, error) {
	resp, err := http.Get("https://nolongr.vercel.app/api/url-id-length")
	if err != nil {
		log.Print("(CreateUrl) /api/url-id-length", err)
	}
	defer resp.Body.Close()

	var urlIdLengthResponse map[string]interface{}

	scanner := bufio.NewScanner(resp.Body)
	for i := 0; scanner.Scan() && i < 5; i++ {
		log.Println(scanner.Text())
		byt := []byte(scanner.Text())
		if err := json.Unmarshal(byt, &urlIdLengthResponse); err != nil {
			panic(err)
		}
	}

	defaultIdLength := 2
	urlIdLength := int(urlIdLengthResponse["result"].(float64))

	if urlIdLength != defaultIdLength {
		urlIdLength = int(math.Max(float64(defaultIdLength), float64(urlIdLength)))
	}

	newURLID := randomSequence(urlIdLength)

	doesUrlIdExist := checkIfUrlIdExists(newURLID)

	doesUrlIdExistCounter := 0
	for doesUrlIdExist {
		newURLID = randomSequence(urlIdLength)
		if doesUrlIdExistCounter > 10 {
			log.Print("(CreateUrl) POTENTIALLY CRITICAL - URL ID LENGTH NEEDS TO BE INCREMENTED")
			newURLID = randomSequence(urlIdLength + 1)
		} else {
			doesUrlIdExistCounter = doesUrlIdExistCounter + 1
		}
	}

	var sqlPassword = sql.NullString{String: password, Valid: false}

	if password != "" {
		sqlPassword = sql.NullString{String: password, Valid: true}
	}

	newUrlData := URLData{
		Destination:  url,
		ID:           newURLID,
		DateCreated:  time.Now().UTC().Format(time.RFC3339),
		URL:          PRODUCTION_SITE_URL + "/" + newURLID,
		SessionToken: sessionToken,
		Password:     sqlPassword,
	}

	if selfDestruct > 0 {
		selfDestructDuration := time.Second * time.Duration(selfDestruct)
		newUrlData.SelfDestruct = time.Now().UTC().Add(selfDestructDuration).Format(time.RFC3339)
	} else {
		newUrlData.SelfDestruct = ""
	}

	query := "INSERT INTO urls (id, destination, date_created, url, self_destruct, session_token, password) VALUES (?, ?, ?, ?, ?, ?, ?)"
	db, err := getNewPlanetScaleClient()
	_, err = db.Exec(query,
		newUrlData.ID,
		newUrlData.Destination,
		newUrlData.DateCreated,
		newUrlData.URL,
		newUrlData.SelfDestruct,
		newUrlData.SessionToken,
		newUrlData.Password,
	)

	if err != nil {
		log.Print("(CreateUrl) db.Exec", err)
	}

	return newUrlData, err
}

func GetUrls() ([]URLData, error) {
	db, err := getNewPlanetScaleClient()
	query := "SELECT * FROM urls"
	res, err := db.Query(query)
	defer res.Close()
	if err != nil {
		log.Print("(GetUrls) db.Query", err)
	}

	urls := []URLData{}
	for res.Next() {
		var urlData URLData
		err := res.Scan(
			&urlData.ID,
			&urlData.Destination,
			&urlData.DateCreated,
			&urlData.URL,
			&urlData.SelfDestruct,
			&urlData.SessionToken,
			&urlData.Password,
		)
		if err != nil {
			log.Print("(GetUrls) res.Scan", err)
		}
		urls = append(urls, urlData)
	}

	return urls, err
}

func GetSingleUrl(id string) (URLData, error) {
	urlData := URLData{}
	query := `SELECT * FROM urls WHERE id = ?`
	db, err := getNewPlanetScaleClient()
	err = db.QueryRow(query, id).Scan(
		&urlData.ID,
		&urlData.Destination,
		&urlData.DateCreated,
		&urlData.URL,
		&urlData.SelfDestruct,
		&urlData.SessionToken,
		&urlData.Password,
	)
	if err != nil {
		log.Println("(GetSingleUrl) db.Exec", err)
	}

	return urlData, err
}

func GetSingleUrlUnexpired(id string) (URLData, error) {
	urlData := URLData{}
	query := `SELECT * FROM urls WHERE id = ? AND self_destruct = '' OR self_destruct > ?`
	db, err := getNewPlanetScaleClient()
	timeNow := time.Now().UTC().Format(time.RFC3339)

	err = db.QueryRow(query, id, timeNow).Scan(
		&urlData.ID,
		&urlData.Destination,
		&urlData.DateCreated,
		&urlData.URL,
		&urlData.SelfDestruct,
		&urlData.SessionToken,
		&urlData.Password,
	)
	if err != nil {
		log.Println("(GetSingleUrlUnexpired) db.Exec", err)
	}

	return urlData, err
}

func GetAllUrlsBasedOnSessionToken(sessionToken string) ([]URLData, error) {
	db, err := getNewPlanetScaleClient()
	query := "SELECT * FROM urls WHERE session_token = ?"
	res, err := db.Query(query, sessionToken)
	defer res.Close()
	if err != nil {
		log.Print("(GetAllUrlsBasedOnSessionToken) db.Query", err)
	}

	urls := []URLData{}
	for res.Next() {
		var urlData URLData
		err := res.Scan(
			&urlData.ID,
			&urlData.Destination,
			&urlData.DateCreated,
			&urlData.URL,
			&urlData.SelfDestruct,
			&urlData.SessionToken,
			&urlData.Password,
		)
		if err != nil {
			log.Print("(GetAllUrlsBasedOnSessionToken) res.Scan", err)
		}
		urls = append(urls, urlData)
	}

	return urls, err
}

func GetAllExpiredUrls() ([]URLData, error) {
	db, err := getNewPlanetScaleClient()
	query := "SELECT * FROM urls WHERE self_destruct <> '' AND self_destruct < ?"
	timeNow := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Query(query, timeNow)
	defer res.Close()
	if err != nil {
		log.Print("(GetAllExpiredUrls) db.Query", err)
	}

	urls := []URLData{}
	for res.Next() {
		var urlData URLData
		err := res.Scan(&urlData.ID, &urlData.Destination, &urlData.DateCreated, &urlData.URL, &urlData.SelfDestruct, &urlData.SessionToken)
		if err != nil {
			log.Print("(GetAllExpiredUrls) res.Scan", err)
		}
		urls = append(urls, urlData)
	}

	return urls, err
}

func DeleteFromDatabase(id string, sessionToken string) (bool, error) {
	query := `DELETE FROM urls WHERE id = ? AND session_token = ?`
	db, err := getNewPlanetScaleClient()
	err = db.QueryRow(query, id, sessionToken).Err()
	if err != nil {
		log.Println("(DeleteFromDatabase) db.Exec error:", id, err)
		return false, err
	}

	return true, err
}

func DeleteAllExpiredDocuments() ([]string, error) {
	db, err := getNewPlanetScaleClient()
	query := "DELETE FROM urls WHERE self_destruct < ?"
	timeNow := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Query(query, timeNow)
	defer res.Close()
	if err != nil {
		log.Print("(DeleteAllExpiredDocuments) db.Query", err)
	}

	urls := []string{}
	for res.Next() {
		var urlData URLData
		err := res.Scan(
			&urlData.ID,
			&urlData.Destination,
			&urlData.DateCreated,
			&urlData.URL,
			&urlData.SelfDestruct,
			&urlData.SessionToken,
			&urlData.Password,
		)
		if err != nil {
			log.Print("(DeleteAllExpiredDocuments) res.Scan", err)
		}
		urls = append(urls, urlData.ID)
	}

	return urls, err
}

func checkIfUrlIdExists(urlId string) bool {
	_, err := GetSingleUrl(urlId)
	if err != nil {
		if err == sql.ErrNoRows {
			return false
		} else {
			log.Println("(checkIfUrlIdExists) error:", err)
			return true
		}
	} else {
		return true
	}
}

// CREATE TABLE urls(
// 	id VARCHAR(20) NOT NULL,
// 	destination VARCHAR(2048) NOT NULL,
// 	date_created DATE NOT NULL,
// 	url VARCHAR(2048) NOT NULL,
// 	self_destruct DATE,
// 	session_token VARCHAR(50)
// 	PRIMARY KEY ( id )
//  );
