# Process Images with Gulp

#### Set-up:

- `git clone https://github.com/benreckas/gulp-image-processing.git`
- [Install gulp](https://gulpjs.org/getting-started) globally if it isn't already installed on your machine.
- From the project root run `npm install`
- Adjust the desired settings in the `gulpfile.js`
  - You can learn more about all of the configuration options at [gulp-image-resize](https://www.npmjs.com/package/gulp-image-resize).

### Processing the Images:

- Put the photos you want to be processed into the `image-raw` directory.
- From the project root run `gulp img` to process the images.
- Your processed images will be placed in the `image-processed` directory.