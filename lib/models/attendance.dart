class Attendance {
  final String id;
  final String studentId;
  final String studentName;
  final String roomNumber;
  final DateTime date;
  final String dateKey; // 'yyyy-MM-dd'
  final String status; // 'Present', 'Absent', 'Leave'

  Attendance({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.roomNumber,
    required this.date,
    required this.dateKey,
    required this.status,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'studentId': studentId,
      'studentName': studentName,
      'roomNumber': roomNumber,
      'date': date.toIso8601String(),
      'dateKey': dateKey,
      'status': status,
    };
  }

  factory Attendance.fromMap(Map<String, dynamic> map) {
    final parsedDate = map['date'] != null ? DateTime.parse(map['date']) : DateTime.now();
    return Attendance(
      id: map['id'] ?? '',
      studentId: map['studentId'] ?? '',
      studentName: map['studentName'] ?? '',
      roomNumber: map['roomNumber'] ?? '',
      date: parsedDate,
      dateKey: map['dateKey'] ?? "${parsedDate.year}-${parsedDate.month.toString().padLeft(2, '0')}-${parsedDate.day.toString().padLeft(2, '0')}",
      status: map['status'] ?? 'Present',
    );
  }
}
