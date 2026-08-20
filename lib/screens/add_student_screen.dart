import 'package:flutter/material.dart';
import '../models/student.dart';
import '../utils/database_helper.dart';
import '../widgets/specular_button.dart';

class AddStudentScreen extends StatefulWidget {
  const AddStudentScreen({super.key});

  @override
  State<AddStudentScreen> createState() => _AddStudentScreenState();
}

class _AddStudentScreenState extends State<AddStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _rollController = TextEditingController();
  final _roomController = TextEditingController();
  final _phoneController = TextEditingController();
  int _selectedAvatarIndex = 0;
  bool _isSaving = false;

  final List<String> _avatars = [
    '👤', '🎓', '🦁', '🦉', '🦊', '🐼', '🐨', '🐸'
  ];

  Future<void> _saveStudent() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
    });

    final String studentId = _rollController.text.trim();

    final student = Student(
      id: studentId,
      name: _nameController.text.trim(),
      rollNumber: studentId,
      roomNumber: _roomController.text.trim(),
      phoneNumber: _phoneController.text.trim(),
      avatarIndex: _selectedAvatarIndex,
      createdAt: DateTime.now(),
    );

    try {
      await DatabaseHelper.addStudent(student);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${student.name} added to registry!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving student: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _rollController.dispose();
    _roomController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Student'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar Picker
                Text(
                  'Select Avatar',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 60,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _avatars.length,
                    itemBuilder: (context, index) {
                      final isSelected = _selectedAvatarIndex == index;
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedAvatarIndex = index;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.only(right: 12),
                          width: 55,
                          height: 55,
                          decoration: BoxDecoration(
                            color: isSelected ? theme.primaryColor.withOpacity(0.2) : theme.cardColor,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected ? theme.primaryColor : theme.dividerColor,
                              width: 2,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              _avatars[index],
                              style: const TextStyle(fontSize: 26),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 32),

                // Form Fields
                TextFormField(
                  controller: _nameController,
                  decoration: InputDecoration(
                    labelText: 'Full Name',
                    hintText: 'e.g. Aryan Mhapralkar',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.person_outline),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty ? 'Please enter name' : null,
                ),
                const SizedBox(height: 20),

                TextFormField(
                  controller: _rollController,
                  decoration: InputDecoration(
                    labelText: 'Roll Number / ID',
                    hintText: 'e.g. FY-1025',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.badge_outlined),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty ? 'Please enter Roll Number' : null,
                ),
                const SizedBox(height: 20),

                TextFormField(
                  controller: _roomController,
                  decoration: InputDecoration(
                    labelText: 'Room Number',
                    hintText: 'e.g. 101',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.meeting_room_outlined),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty ? 'Please enter Room Number' : null,
                ),
                const SizedBox(height: 20),

                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Phone Number',
                    hintText: 'e.g. +91 98765 43210',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: const Icon(Icons.phone_outlined),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty ? 'Please enter phone number' : null,
                ),
                const SizedBox(height: 40),

                // Specular Button
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: SpecularButton(
                    onPressed: _isSaving ? null : _saveStudent,
                    radius: 14,
                    baseColor: theme.dividerColor,
                    lineColor: theme.primaryColor,
                    intensity: 1.0,
                    autoAnimate: true,
                    disabled: _isSaving,
                    child: _isSaving
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'Save Student',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
