"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from "react-native"
import * as ImagePicker from "expo-image-picker"
import * as DocumentPicker from "expo-document-picker"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "../constants/Colors"
import { uploadDocument } from "../api/tasks"

export default function ScanDocumentScreen({ navigation }: any) {
  const [image, setImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image. Please try again.")
    }
  }

  const takePhoto = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync()

      if (cameraPermission.status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to take photos.")
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo. Please try again.")
    }
  }

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      })

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking document:", error)
      Alert.alert("Error", "Failed to pick document. Please try again.")
    }
  }

  const uploadImage = async () => {
    if (!image) {
      Alert.alert("Error", "Please select an image or document first")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create form data
      const formData = new FormData()

      // Get file name and type from URI
      const uriParts = image.split(".")
      const fileType = uriParts[uriParts.length - 1]

      // @ts-ignore - FormData accepts File objects
      formData.append("file", {
        uri: image,
        name: `document.${fileType}`,
        type: fileType === "pdf" ? "application/pdf" : `image/${fileType}`,
      })

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10
          if (newProgress >= 100) {
            clearInterval(progressInterval)
            return 100
          }
          return newProgress
        })
      }, 300)

      // Upload document
      const response = await uploadDocument(formData)

      clearInterval(progressInterval)
      setUploadProgress(100)

      Alert.alert("Success", `Document uploaded successfully. ${response.tasksExtracted} tasks extracted.`, [
        {
          text: "OK",
          onPress: () => navigation.navigate("Home"),
        },
      ])
    } catch (error) {
      console.error("Error uploading document:", error)
      Alert.alert("Error", "Failed to upload document. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Document</Text>
        <Text style={styles.subtitle}>Upload a document or take a photo of your cleaning task sheet</Text>
      </View>

      <View style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="document-text-outline" size={80} color={Colors.light.tabIconDefault} />
            <Text style={styles.placeholderText}>No document selected</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto} disabled={isUploading}>
          <Ionicons name="camera-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={pickImage} disabled={isUploading}>
          <Ionicons name="image-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.documentButton]} onPress={pickDocument} disabled={isUploading}>
          <Ionicons name="document-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>PDF</Text>
        </TouchableOpacity>
      </View>

      {isUploading ? (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.uploadingText}>Uploading and processing document...</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{uploadProgress}%</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, !image && styles.disabledButton]}
          onPress={uploadImage}
          disabled={!image}
        >
          <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <View style={styles.infoItem}>
          <Ionicons name="scan-outline" size={24} color={Colors.light.tint} />
          <Text style={styles.infoText}>Take a photo or upload a document of your cleaning task sheet</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="analytics-outline" size={24} color={Colors.light.tint} />
          <Text style={styles.infoText}>Our AI will process and extract tasks from the document</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="list-outline" size={24} color={Colors.light.tint} />
          <Text style={styles.infoText}>Tasks will be automatically added to your schedule</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
    marginTop: 5,
  },
  imageContainer: {
    width: "100%",
    height: 250,
    backgroundColor: "#fff",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    marginTop: 10,
    color: Colors.light.tabIconDefault,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cameraButton: {
    backgroundColor: "#4CAF50",
  },
  galleryButton: {
    backgroundColor: "#2196F3",
  },
  documentButton: {
    backgroundColor: "#FF9800",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 5,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  uploadingContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  uploadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.light.text,
  },
  progressBarContainer: {
    width: "100%",
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    marginTop: 10,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.light.tint,
  },
  progressText: {
    marginTop: 5,
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  infoContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: Colors.light.text,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 10,
    flex: 1,
  },
})
