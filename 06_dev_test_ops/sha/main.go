package main

import (
	"context"
	"fmt"
	"time"
	"os"
	"os/signal"
	"flag"
	"crypto/sha1"
	"net/http"
	"syscall"
	"encoding/hex"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

const (
	defaultPort = "8080"
	shutdownTimeout = 2 * time.Second
)

func init() {
	logrus.SetFormatter(&logrus.JSONFormatter{})
	logrus.SetLevel(logrus.DebugLevel)
	logrus.SetOutput(os.Stdout)
	flag.Parse()
}

// Server wraps the Mux router
type Server struct {
	Mux *mux.Router
}

// ServeHTTP is an HTTP handler
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.Mux.ServeHTTP(w, r)
}

func shaHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	str := vars["input"]

	h := sha1.New()
	h.Write([]byte(str))
	sha := hex.EncodeToString(h.Sum(nil))

	w.Header().Set("Input", str)
	w.Write([]byte(sha))
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	s := &Server{
		Mux: mux.NewRouter(),
	}

	s.Mux.HandleFunc("/{input}", shaHandler).Methods("GET")

	hs := &http.Server{
		Handler: s,
		Addr: fmt.Sprintf(":%s", port),
		WriteTimeout: 15 * time.Second,
		ReadTimeout: 15 * time.Second,
	}

	go func() {
		logrus.Printf("Running on %s", defaultPort)
		if err := hs.ListenAndServe(); err != http.ErrServerClosed {
			logrus.Fatalf("failed to start the server %+v", err)
		}
	}()

	shutdown(hs, shutdownTimeout)
}

// shutdown gracefully shuts down the HTTP server
func shutdown(h *http.Server, timeout time.Duration) {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	logrus.Printf("shutting down with timeout %s", timeout)
	if err := h.Shutdown(ctx); err != nil {
		logrus.Fatalf("shutdown failed: %v", err)
	} else {
		logrus.Printf("shutdown completed")
	}
}