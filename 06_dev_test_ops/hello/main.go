package main
import (
	"fmt"
	"net/http"
)

func helloHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Hello!")
}

func goodbyeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Goodbye!")
}

func main() {
	http.HandleFunc("/hello", helloHandler)
	http.HandleFunc("/goodbye", goodbyeHandler)

	http.ListenAndServe(":8080", nil)
}