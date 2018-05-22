const del = require("del");
const deleteEmpty = require("delete-empty");
const globby = require("globby");
const gulp = require("gulp");
const gulpImagemin = require("gulp-imagemin");
const gulpImageresize = require("gulp-image-resize");
const gulpNewer = require("gulp-newer");
const merge2 = require("merge2");

/**
 *
 * Make your desired changes or add additional objects to the transforms arrary below.
 * For param details go to: https://www.npmjs.com/package/gulp-image-resize
 *
 */

const transforms = [
  {
    src: "./image-raw/*",
    dist: "./image-processed/",
    params: {
      width: 1000,
      height: 0,
      crop: false,
      gravity: "Center",
      quality: .6
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
 * Process Images
 * 1. walk transforms array to build an array of streams
 *    - get src images
 *    - check if images in src are newer than images in dist
 *    - if they are, process images and minify
 * 2. merge streams to create all images in parallel
 */

gulp.task("img:process", ["img:clean"], () => {
  const streams = [];
  transforms.map((transform) => {
    streams.push(
      gulp.src(transform.src)
        .pipe(gulpNewer(`${transform.dist}${transform.params.width}x${transform.params.height}`))
        .pipe(gulpImageresize({
          /**
           *
           * Add additional properties here from the transforms array.
           *
           */
          imageMagick: true,
          width: transform.params.width,
          height: transform.params.height,
          crop: transform.params.crop,
          gravity: transform.params.gravity,
          quality: transform.params.quality
        }))
        .pipe(gulpImagemin({
          progressive: true,
          svgoPlugins: [{ removeViewBox: false }, { removeUselessStrokeAndFill: false }]
        }))
        .pipe(gulp.dest(`${transform.dist}${transform.params.width}x${transform.params.height}`))
    );
  });
  return merge2(streams);
});

/**
 * Clean images
 * 1. get arrays of filepaths in images src (base images) and dist (base base and processed images)
 * 2. Diffing process
 *    - build list of filepaths in src
 *    - loop through filepaths in dist, remove files within dist
 *      to get both base images and corresponding processed images, compare with filepaths in src
 *    - if no match, add full dist image filepath to delete array
 * 3. Delete files (base images and processed images)
 */

gulp.task("img:clean", ["img:clean:directories"], () => {
  return Promise.all([
    globby("./image-raw/**/*", { nodir: true }),
    globby("./image-processed/**/*", { nodir: true })
  ])
  .then((paths) => {
    const srcFilepaths = paths[0];
    const distFilepaths = paths[1];
    const distFilesToDelete = [];
    distFilepaths.map((distFilepath) => {
      const distFilepathFiltered = distFilepath.replace(/\/public/, "").replace(/thumbs_[0-9]+x[0-9]+\//, "");
      if ( srcFilepaths.indexOf(distFilepathFiltered) === -1 ) {
        distFilesToDelete.push(distFilepath);
      }
    });
    return distFilesToDelete;
  })
  .then((distFilesToDelete) => {
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
 *    - Diffing: array of all unused image directories in dist
 * 2. Delete files
 * 3. Delete all empty folders in dist images
 */

gulp.task("img:clean:directories", () => {
  globby("./image-processed/**/thumbs_+([0-9])x+([0-9])/")
    .then((paths) => {
      console.log("All thumbs folders: " + paths);
      const distThumbsDirs = paths;
      const srcThumbsDirs = transforms.map((transform) => transform.dist + "thumbs_" + transform.params.width + "x" + transform.params.height + "/");
      const todeleteThumbsDirs = distThumbsDirs.filter((el) => srcThumbsDirs.indexOf(el) === -1);
      console.log("To delete thumbs folders: " + todeleteThumbsDirs);
      return todeleteThumbsDirs;
    })
    .then((todeleteThumbsDirs) => {
      del.sync(todeleteThumbsDirs);
    })
    .then(() => {
      deleteEmpty.sync("./image-processed/");
    })
    .catch((error) => {
      console.log(error);
    });
});

/**
 * Gulp Task Commands
 */

gulp.task("img", ["img:copy", "img:process"]);
gulp.task("watch", ["browser-sync"], () => {
  gulp.watch(["image-raw/**/*"], ["img"]);
});
