class Student {
  final String id;
  final String name;
  final String rollNumber;
  final String roomNumber;
  final String phoneNumber;
  final int avatarIndex;
  final DateTime createdAt;

  Student({
    required this.id,
    required this.name,
    required this.rollNumber,
    required this.roomNumber,
    required this.phoneNumber,
    required this.avatarIndex,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'rollNumber': rollNumber,
      'roomNumber': roomNumber,
      'phoneNumber': phoneNumber,
      'avatarIndex': avatarIndex,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory Student.fromMap(Map<String, dynamic> map) {
    return Student(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      rollNumber: map['rollNumber'] ?? '',
      roomNumber: map['roomNumber'] ?? '',
      phoneNumber: map['phoneNumber'] ?? '',
      avatarIndex: map['avatarIndex'] ?? 0,
      createdAt: map['createdAt'] != null
          ? DateTime.parse(map['createdAt'])
          : DateTime.now(),
    );
  }
}
