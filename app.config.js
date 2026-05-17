const appJson = require('./app.json');

const gaodeAndroidKey =
  process.env.AMAP_ANDROID_KEY ?? process.env.EXPO_PUBLIC_AMAP_ANDROID_KEY;
const gaodeIosKey =
  process.env.AMAP_IOS_KEY ?? process.env.EXPO_PUBLIC_AMAP_IOS_KEY;
const gaodeLocationDescription =
  '允许“集刻”访问你的位置，用于推荐附近文化点位与距离排序。';

module.exports = {
  ...appJson.expo,
  plugins: [
    ...appJson.expo.plugins,
    [
      'expo-gaode-map',
      {
        androidKey: gaodeAndroidKey,
        iosKey: gaodeIosKey,
        enableLocation: true,
        enableBackgroundLocation: false,
        locationDescription: gaodeLocationDescription,
      },
    ],
  ],
};
