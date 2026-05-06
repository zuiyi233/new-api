package main

import (
	"fmt"

	sqlite "github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type User struct {
	ID          uint
	Username    string
	Email       string
	Role        int
	Status      int
	AccessToken string
	DeletedAt   gorm.DeletedAt
	CreatedAt   int64
	UpdatedAt   int64
}

func main() {
	db, err := gorm.Open(sqlite.Open("N:/new-api-main/data/one-api.db"), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	var users []User
	if err := db.Table("users").Find(&users).Error; err != nil {
		panic(err)
	}
	for _, u := range users {
		fmt.Printf("ID=%d Username=%s Email=%s Role=%d Status=%d Token=%s Deleted=%v CreatedAt=%d UpdatedAt=%d\n",
			u.ID, u.Username, u.Email, u.Role, u.Status, u.AccessToken, u.DeletedAt.Valid, u.CreatedAt, u.UpdatedAt)
	}
}
