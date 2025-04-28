package ws

type Hub struct {
	clients    map[string]*Client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client.Username] = client

		case client := <-h.unregister:
			if _, ok := h.clients[client.Username]; ok {
				delete(h.clients, client.Username)
				close(client.send)
			}

		case message := <-h.broadcast:
			for _, client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client.Username)
				}
			}
		}
	}
}

// Broadcast is an exported method to send a message to all clients.
func (h *Hub) Broadcast(message []byte) {
	h.broadcast <- message
}

// SendToUser sends a message to a specific user.
func (h *Hub) SendToUser(username string, message []byte) {
	if client, ok := h.clients[username]; ok {
		select {
		case client.send <- message:
		default:
			close(client.send)
			delete(h.clients, username)
		}
	}
}
