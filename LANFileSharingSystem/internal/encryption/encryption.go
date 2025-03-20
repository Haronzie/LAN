package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"io"
	"io/ioutil"
)

// EncryptFile encrypts the contents of inputFile and writes the output (nonce + ciphertext) to outputFile.
func EncryptFile(key []byte, inputFile, outputFile string) error {
	// Read the plaintext file data.
	plaintext, err := ioutil.ReadFile(inputFile)
	if err != nil {
		return err
	}

	// Create a new AES cipher block with the given key.
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	// Wrap the block in Galois/Counter Mode (GCM) for authenticated encryption.
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	// Generate a random nonce.
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}

	// Encrypt the plaintext.
	ciphertext := aesGCM.Seal(nil, nonce, plaintext, nil)

	// Prepend the nonce to the ciphertext so that it can be used for decryption.
	finalData := append(nonce, ciphertext...)

	// Write the encrypted data to the output file.
	return ioutil.WriteFile(outputFile, finalData, 0644)
}

// DecryptFile decrypts the contents of inputFile (expects nonce + ciphertext)
// and writes the decrypted plaintext to outputFile.
func DecryptFile(key []byte, inputFile, outputFile string) error {
	// Read the encrypted file data.
	data, err := ioutil.ReadFile(inputFile)
	if err != nil {
		return err
	}

	// Create a new AES cipher block with the given key.
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	// Wrap the block in GCM mode.
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return errors.New("ciphertext too short")
	}

	// Extract the nonce and ciphertext.
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]

	// Decrypt the ciphertext.
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return err
	}

	// Write the decrypted data to the output file.
	return ioutil.WriteFile(outputFile, plaintext, 0644)
}
