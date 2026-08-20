class Attendance {
  final String id;
  final String studentId;
  final String studentName;
  final String roomNumber;
  final DateTime date;
  final String status; // 'Present', 'Absent', 'Leave'

  Attendance({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.roomNumber,
    required this.date,
    required this.status,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'studentId': studentId,
      'studentName': studentName,
      'roomNumber': roomNumber,
      'date': date.toIso8601String(),
      'status': status,
    };
  }

  factory Attendance.fromMap(Map<String, dynamic> map) {
    return Attendance(
      id: map['id'] ?? '',
      studentId: map['studentId'] ?? '',
      studentName: map['studentName'] ?? '',
      roomNumber: map['roomNumber'] ?? '',
      date: map['date'] != null ? DateTime.parse(map['date']) : DateTime.now(),
      status: map['status'] ?? 'Present',
    );
  }
}
