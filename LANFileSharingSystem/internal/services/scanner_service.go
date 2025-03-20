// internal/services/scanner_service.go
package services

import (
	"os"

	"github.com/dutchcoders/go-clamd"
)

// ScanResult represents the result of scanning a file.
type ScanResult struct {
	Clean       bool
	Description string
}

// ScanFile uses ClamAV to scan the file at filePath.
func ScanFile(filePath string) (ScanResult, error) {
	clam := clamd.NewClamd("tcp://127.0.0.1:3310")

	// Open the file for scanning.
	f, err := os.Open(filePath)
	if err != nil {
		return ScanResult{}, err
	}
	defer f.Close()

	// Scan the file using a stream.
	response, err := clam.ScanStream(f, make(chan bool))
	if err != nil {
		return ScanResult{}, err
	}
	for s := range response {
		if s.Status == clamd.RES_OK {
			return ScanResult{Clean: true, Description: "File is clean"}, nil
		} else if s.Status == clamd.RES_FOUND {
			return ScanResult{Clean: false, Description: s.Description}, nil
		}
	}
	return ScanResult{Clean: true, Description: "Unknown result"}, nil
}
