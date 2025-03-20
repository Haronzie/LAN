package services_test

import (
	"io/ioutil"
	"os"
	"testing"

	"LANFileSharingSystem/internal/services"
)

// TestScanFileClean verifies that a benign file is reported as clean.
func TestScanFileClean(t *testing.T) {
	// Create a temporary file with benign content.
	tmpFile, err := ioutil.TempFile("", "clean")
	if err != nil {
		t.Fatalf("Error creating temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString("This is a clean file."); err != nil {
		t.Fatalf("Error writing to temp file: %v", err)
	}
	tmpFile.Close()

	// Call the ScanFile function.
	result, err := services.ScanFile(tmpFile.Name())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if !result.Clean {
		t.Errorf("Expected file to be clean, got: %v", result.Description)
	}
}

// TestScanFileMalicious verifies that a file with the EICAR test signature is flagged.
func TestScanFileMalicious(t *testing.T) {
	// The EICAR test signature. Make sure it's exactly as required by ClamAV.
	eicarContent := `X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`

	// Create a temporary file with the EICAR signature.
	tmpFile, err := ioutil.TempFile("", "malicious")
	if err != nil {
		t.Fatalf("Error creating temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(eicarContent); err != nil {
		t.Fatalf("Error writing to temp file: %v", err)
	}
	tmpFile.Close()

	// Call the ScanFile function.
	result, err := services.ScanFile(tmpFile.Name())
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if result.Clean {
		t.Errorf("Expected file to be flagged as malicious, but it was reported clean")
	}
}
