# trackifyr: AI-Based Cognitive Load Estimation via Natural Activity Monitoring

**Final Year Project (FYP) – Phase I**

trackifyr is an intelligent AI system designed to estimate cognitive load in real-time by analyzing natural user activities during digital work and study sessions. Unlike traditional digital wellbeing tools that only measure screen time, trackifyr uses multimodal behavioral signals (facial expressions, gaze patterns, keyboard, and mouse interactions) to classify cognitive load into three categories: **Low**, **Medium**, and **High**.

This repository contains the complete Phase-I development work, including requirement analysis, activity tracking implementation, web dashboard prototype, and initial system architecture.

---

## 👥 Team Members

| Name | Registration # | Email | Contact |
|------|----------------|-------|---------|
| **Muhammad Moin U Din** (Group Leader) | BCSF22M023 | bcsf22m023@pucit.edu.pk | 0302-8791634 |
| **Muhammad Junaid Malik** | BCSF22M031 | bcsf22m031@pucit.edu.pk | 0326-5869774 |
| **Muhammad Subhan Ul Haq** | BCSF22M043 | bcsf22m043@pucit.edu.pk | 0333-8133811 |

---

## 📋 Project Overview

| Field | Description |
|-------|-------------|
| **FYP Title** | AI-Based Cognitive Load Estimation via Natural Activity Monitoring |
| **Area of Specialization** | Image processing, Computer Vision, Web Development |
| **Nature of Project** | R&D (Research and Development) |
| **Degree** | BS (Hons.) Computer Science |
| **Session** | 2022-2026 |
| **Project Advisor** | Prof. Tayyaba Tariq |
| **Institution** | Department of Computer Science, FCIT, University of the Punjab |

---

## 🎯 Project Goal

To design and develop an AI-based system that estimates cognitive load (Low, Medium, High) in real-time by analyzing multimodal signals:
- **Facial expressions** (frowning, yawning, raised eyebrows)
- **Eye gaze tracking** and blink rate
- **Keyboard typing patterns** (speed, pauses, error corrections)
- **Mouse interaction behaviors** (movement patterns, hesitation)

---

## 🧠 System Overview (Phase-I)

### Core Components Implemented:

✅ **Activity Tracker (Desktop Logger)**
- Real-time mouse and keyboard activity monitoring
- 10-second interval summaries with activity percentage
- Cross-platform compatibility (Windows, Linux, macOS)

✅ **Web Dashboard Prototype**
- React.js/Next.js based frontend
- User authentication and profile management
- Cognitive load visualization and charts
- Session logs and reports

✅ **Initial System Architecture**
- FastAPI backend (planned)
- PostgreSQL database design
- Real-time data processing pipeline

### Planned Components (Phase-II):

🔄 **Facial Feature Extraction**
- MediaPipe/OpenCV integration for facial cues
- Gaze tracking and blink rate detection
- Micro-expression recognition

🔄 **Machine Learning Models**
- Baseline models (Random Forest, SVM)
- Deep learning models (CNN + LSTM)
- Multimodal feature fusion

🔄 **Feedback Mechanism**
- Real-time alerts ("Take a break" notifications)
- Teacher dashboard for class engagement monitoring

---

## 🛠️ Technology Stack

### Programming Languages & Frameworks
- **Python** - ML model development, activity tracking, backend
- **JavaScript (React.js/Next.js)** - Web dashboard frontend
- **Electron.js** - Desktop application (planned)

### Machine Learning & AI Libraries
- **TensorFlow / PyTorch** - Deep learning models (CNN, LSTM)
- **scikit-learn** - Classical ML algorithms (Random Forest, SVM)
- **MediaPipe / OpenCV** - Facial feature detection, gaze tracking
- **DeepFace** - Emotion and micro-expression recognition

### Data Handling & Storage
- **PostgreSQL** - Logs and processed data storage
- **Pandas & NumPy** - Dataset management and feature engineering

### Development Tools
- **Git & GitHub** - Version control and collaboration
- **Jupyter Notebook** - Experimentation and model evaluation
- **Docker** - Containerization (planned)

### Visualization
- **React Charts / Recharts** - Real-time engagement visualizations
- **Matplotlib / Seaborn** - Feature trend analysis

---

## 📊 Key Resources

| Resource | Value |
|----------|-------|
| **Primary Datasets** | DAISEE (Dataset for Affective States in E-Environments), CLT (Cognitive Load Theory datasets), CLARE |
| **Project Management** | JIRA (planned) |
| **Version Control** | GitHub Repository |
| **Documentation** | FYP Proposal, Literature Review, Phase-I Report |

---

## 📁 Repository Structure

```
trackifyr-Cognitive_Load_Management_via_NAM/
├── trackifyr-py/              # Python backend and activity tracker
│   ├── activity_tracker.py    # Mouse/keyboard activity monitoring
│   ├── requirements.txt       # Python dependencies
│   └── README.md              # Activity tracker documentation
├── trackifyr-web/             # Web dashboard frontend
│   ├── app/                   # Next.js app routes
│   ├── components/            # React components
│   ├── context/               # React context providers
│   └── package.json           # Node.js dependencies
├── AI-Based Cognitive Load Estimation via NAM FYP Proposal.pdf
├── Literature Review.pdf
├── FYP-I-Report.pdf
└── README.md                  # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL (for production)

### Activity Tracker Setup

```bash
cd trackifyr-py
pip install -r requirements.txt
python activity_tracker.py
```

### Web Dashboard Setup

```bash
cd trackifyr-web
npm install
npm run dev
```

---

## 📈 Phase-I Status

### Completed ✅
- ✅ Requirement Analysis
- ✅ Literature Review
- ✅ System Architecture Design
- ✅ Activity Tracker Implementation (Mouse/Keyboard)
- ✅ Web Dashboard Prototype (React/Next.js)
- ✅ Initial Database Schema Design
- ✅ Project Documentation

### In Progress 🔄
- 🔄 Facial Feature Extraction Pipeline
- 🔄 Baseline Model Training (Random Forest/SVM)
- 🔄 Feature Engineering and Preprocessing

### Planned 📋
- 📋 Deep Learning Model Development (CNN+LSTM)
- 📋 Multimodal Feature Fusion
- 📋 Real-time Feedback System
- 📋 Teacher Dashboard
- 📋 Comprehensive Testing & Evaluation

---

## 🎓 Success Criteria

The project will be considered successful if it can:

1. ✅ Correctly categorize user cognitive load as **Low**, **Medium**, and **High** with satisfactory performance on benchmark datasets (DAISEE, CLT)
2. ✅ Provide real-time monitoring using desktop application without significant delay
3. ✅ Incorporate multiple input sources (webcam, keyboard, mouse) and generate consistent outputs
4. ✅ Effectively display results on web-based dashboard with logs, visualizations, and feedback notifications
5. ✅ Be accepted by supervisor as achieving defined objectives for practical applications

---

## 📚 Research Contributions

### Research Gaps Addressed
- Most prior studies are dataset-driven rather than building end-to-end usable systems
- Many focus on intrusive physiological sensors (EEG, ECG)
- Approaches often restricted to controlled lab environments

### Our Contribution
- **Natural activity monitoring** using webcam, keyboard, and mouse during normal digital work
- **Real-time automatic detection** using multimodal features
- **Actionable feedback** (break reminders) instead of only data labeling
- **Practical tools**: Desktop app for activity capture and web dashboard for visualization

---

## 📎 Notes for Evaluators

- Each contribution is traceable through commit history and branch structure
- Code follows modular architecture with clear separation of concerns
- All team members worked on assigned components independently
- Project documentation includes proposal, literature review, and Phase-I report

---

## 📬 Contact

For any clarification regarding this repository or Phase-I deliverables, please contact:

**Project Advisor**: Prof. Tayyaba Tariq  
**Group Leader**: Muhammad Moin U Din (bcsf22m023@pucit.edu.pk)

---

## 📄 License

This project is developed as part of the Final Year Project (FYP) at the Department of Computer Science, FCIT, University of the Punjab.

---

**✨ trackifyr — Monitoring cognitive load through natural activity analysis.**
