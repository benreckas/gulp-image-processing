const del = require("del");
const deleteEmpty = require("delete-empty");
const globby = require("globby");
const gulp = require("gulp");
const gulpImagemin = require("gulp-imagemin");
const gulpImageresize = require("gulp-image-resize");
const gulpNewer = require("gulp-newer");
const merge2 = require("merge2");


// Array of Desired Transforms
const transforms = [
  {
    src: "./image-raw/*",
    dist: "./image-processed/",
    params: {
      width: 800,
      height: 600,
      crop: true,
      quality: 1
    }
  },
  {
    src: "./image-raw/*",
    dist: "./image-processed/",
    params: {
      width: 1500,
      height: 844,
      crop: true,
      quality: 1
    }
  }
];

/**
 * Copy original images
 * - check if images are newer than existing ones
 * - if they are, optimize and copy them
 * - ignore (empty) directories
 */

gulp.task("img:copy", ["img:clean"], () => {
  return gulp.src("./image-raw/**/*", { nodir: true })
    .pipe(gulpNewer("./image-processed/"))
    .pipe(gulpImagemin({
      progressive: true,
      svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }]
    }))
    .pipe(gulp.dest("./image-processed/"));
});

/**
 * Make thumbnails
 * 1. walk transforms array to build an array of streams
 *    - get src images
 *    - check if images in src are newer than images in dist
 *    - if they are, make thumbnails and minify
 * 2. merge streams to create all thumbnails in parallel
 */

gulp.task("img:thumbnails", ["img:clean"], () => {
  // create empty streams array for merge2
  const streams = [];
  // loop through transforms and add to streams array
  transforms.map((transform) => {
    // create a stream for each transform
    streams.push(
      gulp.src(transform.src)
        .pipe(gulpNewer(transform.dist + "thumbs_" + transform.params.width + "x" + transform.params.height))
        .pipe(gulpImageresize({
          imageMagick: true,
          width: transform.params.width,
          height: transform.params.width,
          crop: transform.params.crop,
          quality: transform.params.quality
        }))
        .pipe(gulpImagemin({
          progressive: true,
          svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }]
        }))
        .pipe(gulp.dest(transform.dist + "thumbs_" + transform.params.width + "x" + transform.params.height))
    );
  });
  // merge streams
  return merge2(streams);
});

/**
 * Clean images
 * 1. get arrays of filepaths in images src (base images) and dist (base images and thumbnails)
 * 2. Diffing process
 *    - build list of filepaths in src
 *    - loop through filepaths in dist, remove dist and thumbnails specific parts
 *      to get both base images and corresponding thumbnails, compare with filepaths in src
 *    - if no match, add full dist image filepath to delete array
 * 3. Delete files (base images and thumbnails)
 */

gulp.task("img:clean", ["img:clean:directories"], () => {
  // get arrays of src and dist filepaths (returns array of arrays)
  return Promise.all([
    globby("./image-raw/**/*", { nodir: true }),
    globby("./image-processed/**/*", { nodir: true })
  ])
  .then((paths) => {
    // create arrays of filepaths from array of arrays returned by promise
    const srcFilepaths = paths[0];
    const distFilepaths = paths[1];
    // empty array of files to delete
    const distFilesToDelete = [];
    // diffing
    distFilepaths.map((distFilepath) => {
      // sdistFilepathFiltered: remove dist root folder and thumbs folders names for comparison
      const distFilepathFiltered = distFilepath.replace(/\/public/, "").replace(/thumbs_[0-9]+x[0-9]+\//, "");
      // check if simplified dist filepath is in array of src simplified filepaths
      // if not, add the full path to the distFilesToDelete array
      if ( srcFilepaths.indexOf(distFilepathFiltered) === -1 ) {
        distFilesToDelete.push(distFilepath);
      }
    });
    // return array of files to delete
    return distFilesToDelete;
  })
  .then((distFilesToDelete) => {
    // delete files
    del.sync(distFilesToDelete);
  })
  .catch((error) => {
    console.log(error);
  });
});

/**
 * Clean unused directories
 * 1. Diffing process between src and dist
 *    - Build array of all thumbs_xxx directories that should exist using the transforms map
 *    - Build array of all thumbs_xxx directories actually in dist
 *    - Diffing: array of all unused thumbnails directories in dist
 * 2. Delete files
 * 3. Delete all empty folders in dist images
 */

gulp.task("img:clean:directories", () => {
  globby("./image-processed/**/thumbs_+([0-9])x+([0-9])/")
    .then((paths) => {
      console.log("All thumbs folders: " + paths);
      // existing thumbs directories in dist
      const distThumbsDirs = paths;
      // create array of dirs that should exist by walking transforms map
      const srcThumbsDirs = transforms.map((transform) => transform.dist + "thumbs_" + transform.params.width + "x" + transform.params.height + "/");
      // array of dirs to delete
      const todeleteThumbsDirs = distThumbsDirs.filter((el) => srcThumbsDirs.indexOf(el) === -1);
      console.log("To delete thumbs folders: " + todeleteThumbsDirs);
      // pass array to next step
      return todeleteThumbsDirs;
    })
    .then((todeleteThumbsDirs) => {
      // deleted diff thumbnails directories
      del.sync(todeleteThumbsDirs);
    })
    .then(() => {
      // delete empty directories in dist images
      deleteEmpty.sync("./image-processed/");
    })
    .catch((error) => {
      console.log(error);
    });
});


// `gulp img` to process images
gulp.task("img", ["img:copy", "img:thumbnails"]);

// img  -> img:copy        -> img:clean  -> img:clean:directories
//      -> img:thumbnails  -> img:clean  -> img:clean:directories

// `gulp watch` to sync/update changes if the site is deployed
gulp.task("watch", ["browser-sync"], () => {
  gulp.watch(["image-raw/**/*"], ["img"]);
});
