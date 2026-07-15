# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Preserve source locations and runtime metadata used by Sentry symbolication,
# Expo module discovery, and Mapbox/React Native reflection. Each dependency
# supplies its own consumer rules; these attributes keep those rules effective
# without broadly disabling R8 optimization for the dependency packages.
-keepattributes SourceFile,LineNumberTable,Signature,*Annotation*,InnerClasses,EnclosingMethod

# Native entry points can be reached from JNI rather than Java call sites.
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# Add any project specific keep options here:
