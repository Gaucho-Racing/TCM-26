package model

type Gr26Message struct {
	Timestamp  int    `json:"timestamp" gorm:"index:gr26_message_unsynced_ts,where:synced = 0"`
	VehicleID  string `json:"vehicle_id"`
	Topic      string `json:"topic"`
	Data       []byte `json:"data" gorm:"type:bytea"` // PostgreSQL uses BYTEA for binary data
	Synced     int    `json:"synced"`
	SourceNode string `json:"source_node"`
	TargetNode string `json:"target_node"`
}

func (Gr26Message) TableName() string {
	return "gr26_message"
}
