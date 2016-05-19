module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
    
        watch: {
            test: {
                files: ['test_src/*.js'],
                tasks: ['babel'],
                options: {
                    spawn: false,
                }
            },
            dist: {
                files: ['src/**/*.js'],
                tasks: ['build'],
                options: {
                    spawn: false,
                }
            }
        },
        
        babel: {
            options: {
                sourceMaps: "inline",
                compact: false
            },
            dist: {
                files: {
                    "lib/utils/Logger.js":          "src/utils/Logger.js",
                    "lib/utils/EventEmitter.js":    "src/utils/EventEmitter.js",
                    "lib/BinaryParserBuffer.js":    "src/BinaryParserBuffer.js",
                    "lib/BinaryParser.js":          "src/BinaryParser.js",
                    "lib/ObjectId.js":              "src/ObjectId.js",
                    "lib/SelectorMatcher.js":       "src/SelectorMatcher.js",
                    "lib/Selector.js":              "src/Selector.js",
                    "lib/Cursor.js":                "src/Cursor.js",
                    "lib/Collection.js":            "src/Collection.js",
                    "lib/MongoPortable.js":         "src/MongoPortable.js"
                }
            }
        },
    
        simplemocha: {
            dev: {
                src: ['test/Collection.js']
            },
            
            all: {
                src: ['test/ObjectId.js', 'test/Selector.js', 'test/MongoPortable.js',
                        'test/Cursor.js', 'test/Collection.js']
            }
        },
        
        jsdoc : {
            dist : {
                src: [//'./README.md',
                    'src/MongoPortable.js', 'src/Collection.js', 'src/Cursor.js',
                        'src/Selector.js', 'src/ObjectId.js'],
                options: {
                    destination: 'doc'
                }
            }
        },
        
        jsdoc2md: {
            fullDoc: {
                src: [//'./README.md',
                    'src/MongoPortable.js', 'src/Collection.js', 'src/Cursor.js'],
                dest: 'api/documentation.md'
            },
            apiDoc: {
                files: [
                    { src: 'src/MongoPortable.js', dest: 'api/MongoPortable.md' },
                    { src: 'src/Collection.js', dest: 'api/Collection.md' },
                    { src: 'src/Cursor.js', dest: 'api/Cursor.md' }
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-jsdoc-to-markdown');
    
    // Documentation
    grunt.registerTask('build_doc', ['jsdoc:dist']);
    grunt.registerTask('build_html', ['jsdoc2md:fullDoc', 'jsdoc2md:apiDoc']);
    grunt.registerTask('build_full_doc', ['build_doc', 'build_html']);
    
    grunt.registerTask('watch_dist', ['watch:dist']);
    grunt.registerTask('build_app', ['babel:dist']);
    
    grunt.registerTask('dev_test', ['simplemocha:dev']);
    grunt.registerTask('run_test', ['simplemocha:all']);
    
    grunt.registerTask('full_build', ['build_app', 'build_doc', 'run_test']);
    
    grunt.registerTask('default', ['full_build']);
};