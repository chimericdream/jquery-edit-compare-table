/* global jQuery */
;(function($) {
    'use strict';

    function stop(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    var GROUPED_TABLES = {};

    var pluginName = 'tableEditCompare',
        defaults = {
            'classes': {
                'errorMessage': 'error',
                'infoMessage': 'info',
                'successMessage': 'success'
            },
            'strings': {
                'doneLink': 'Done',
                'editLink': 'Edit',
                'selectAllButton': 'Select All',
                'submitButton': 'Submit',
                'unselectedFields': 'Bad! Select all the things. These were missing:'
            },
            'save': function(data) {
                console.dir(data);
            },
            'dataProviders': {},
            'dataValidators': {}
        };

    function Plugin(element, options) {
        this.options    = $.extend({}, defaults, options);
        this.$element   = $(element);
        this.group      = this.$element.data('group');
        this.identifier = this.$element.data('identifier');
        this.init();
    }

    Plugin.MESSAGE_TYPES = {
        'ERROR': 0,
        'INFO': 1,
        'SUCCESS': 2
    };

    Plugin.prototype.selectCell = function(event) {
        stop(event);
        var $el = $(event.target);

        $el.closest('tr').children('td').removeClass('tec-selected');
        $el.closest('td').addClass('tec-selected');
    };

    Plugin.prototype.selectColumn = function(event) {
        stop(event);
        var $el = $(event.target);
        var col = $el.data('column');

        var $tbody = $el.closest('tbody');

        $tbody.find('td.tec-data-cell')
            .removeClass('tec-selected');

        $tbody.find('td.tec-data-cell:nth-of-type(' + col + ')')
            .addClass('tec-selected');
    };

    Plugin.prototype.toggleEditing = function(event) {
        stop(event);

        var $a = $(event.target).closest('a');
        var $td = $a.closest('tr').find('td.tec-selected');
        if ($td.length === 0) {
            return;
        }

        if ($a.hasClass('tec-editing')) {
            this.updateCellText($td);
        }

        $a.toggleClass('tec-editing');
        $td.toggleClass('tec-editing');
    };

    Plugin.prototype.updateCellText = function($td) {
        var $inputs = $td.find('.tec-data-inputs .tec-input');
        var $spans = $td.find('.tec-data-display span[data-field]');

        if ($spans.length === 0) {
            $td.find('.tec-data-display').text($inputs[0].value);
            return;
        }

        for (var i = 0; i < $inputs.length; i++) {
            $($spans[i]).text($inputs[i].value);
        }
    };

    Plugin.prototype.save = function(event) {
        stop(event);

        this.clearTableMessages();

        var data = this.getData();
        if (this.belongsToAGroup()) {
            var groupHasError = false;
            data = {};
            for (var i = 0; i < GROUPED_TABLES[this.group].length; i++) {
                var table = GROUPED_TABLES[this.group][i];
                table.clearTableMessages();

                data[table.identifier] = table.getData();
                if (!table.allFieldsAreSelected()) {
                    groupHasError = true;
                    table.setTableMessage(
                        this.options.strings.unselectedFields,
                        Plugin.MESSAGE_TYPES.ERROR
                    );
                }
            }
            if (groupHasError) {
                return;
            }
        }

        if (!this.allFieldsAreSelected()) {
            this.setTableMessage(
                this.options.strings.unselectedFields,
                Plugin.MESSAGE_TYPES.ERROR
            );
            return;
        }

        if (typeof this.options.save === 'function') {
            this.options.save(data);
        }
    };

    Plugin.prototype.clearTableMessages = function() {
        this.$element.find('.tec-error-message').remove();
    };

    Plugin.prototype.getMessageClassByType = function(type) {
        if (typeof type === 'undefined') {
            return this.options.classes.infoMessage;
        }

        switch (type) {
            case Plugin.MESSAGE_TYPES.ERROR:
                return this.options.classes.errorMessage;
            case Plugin.MESSAGE_TYPES.SUCCESS:
                return this.options.classes.successMessage;
            case Plugin.MESSAGE_TYPES.INFO:
                return this.options.classes.infoMessage;
            default:
                return this.options.classes.infoMessage;
        }
    };

    Plugin.prototype.setTableMessage = function(message, type) {
        var msgClass = this.getMessageClassByType(type);
        var $errBody = $('<tbody class="tec-error-message"><tr class="' + msgClass + '"><th colspan="3">' + message + '</th></tr></tbody>').hide();
        this.$element.prepend($errBody);
        $errBody.slideDown();
    };

    Plugin.prototype.setFieldMessage = function(field, message, type) {
        if (typeof type === 'undefined') {
            type = Plugin.MESSAGE_TYPES.INFO;
        }
    };

    Plugin.prototype.allFieldsAreSelected = function() {
        var rowCount = this.$element.find('td.tec-data-cell').length / 2;
        var $selected = this.$element.find('td.tec-data-cell.tec-selected');
        return (rowCount === $selected.length);
    };

    Plugin.prototype.getData = function() {
        var data = {};
        this.$element.children('tbody').each(function(idx, tbody) {
            var $tbody = $(tbody);
            var tbodyField = $tbody.data('field');
            if (typeof tbodyField !== 'undefined') {
                data[tbodyField] = {};
            }

            var $inputs = $tbody.find('td.tec-data-cell.tec-selected .tec-data-inputs .tec-input');
            $inputs.each(function(idx, input) {
                if (typeof tbodyField === 'undefined') {
                    data[input.name] = input.value;
                } else {
                    data[tbodyField][input.name] = input.value;
                }
            });
        });
        return data;
    };

    Plugin.prototype.init = function() {
        this.$element.children('tbody').each(function(idx, tbody) {
            this.setupDataCells($(tbody));
            this.setupLabelCells($(tbody));
            this.addButtonRows($(tbody));
        }.bind(this));

        this.addSaveRow();
        this.addEventHandlers();
        this.setupGrouping();
    };

    Plugin.prototype.setupDataCells = function($tbody) {
        var $cells = $tbody.find('td');

        $cells.each(function(idx, td) {
            var $td = $(td);

            var fieldNames = [];
            var fieldVals = [];

            var $spans = $td.find('span[data-field]');
            if ($spans.length === 0) {
                fieldNames.push($td.closest('[data-field]').data('field'));
                fieldVals.push($td.text());
            } else {
                $spans.each(function(unused, span) {
                    var $span = $(span);
                    fieldNames.push($span.data('field'));
                    fieldVals.push($span.text());
                });
            }

            var $inputWrapper = $('<div class="tec-data-inputs"></div>');
            for (var i = 0; i < fieldNames.length; i++) {
                var $input;
                if (this.hasDataProvider(fieldNames[i])) {
                    $input = this.buildSelectInput(fieldNames[i], fieldVals[i]);
                } else {
                    $input = this.buildTextInput(fieldNames[i], fieldVals[i]);
                }
                $inputWrapper.append($input);
            }

            $td.addClass('tec-data-cell')
                .wrapInner('<div class="tec-data-display"></div>')
                .append($inputWrapper);
        }.bind(this));
    };

    Plugin.prototype.hasDataProvider = function(name) {
        return typeof this.options.dataProviders[name] === 'function';
    };

    Plugin.prototype.getDataProvider = function(name) {
        return this.options.dataProviders[name];
    };

    Plugin.prototype.buildTextInput = function(fieldName, value) {
        return $('<input/>', {
            'type': 'text',
            'name': fieldName,
            'value': value,
            'class': 'tec-input'
        });
    };

    Plugin.prototype.buildSelectInput = function(fieldName, value) {
        var $select = $('<select/>', {
            'name': fieldName,
            'class': 'tec-input'
        });
        var options = this.getDataProvider(fieldName)();
        var values = Object.keys(options);
        for (var i = 0; i < values.length; i++) {
            var val = values[i];
            var text = options[val];

            var selected = (val === value) ? ' selected' : '';
            var $option = $('<option value="' + val + '"' + selected + '>' + text + '</option>');
            $select.append($option);
        }

        return $select;
    };

    Plugin.prototype.setupLabelCells = function($tbody) {
        var done = this.options.strings.doneLink;
        var edit = this.options.strings.editLink;
        $tbody.find('th').each(function(idx, th) {
            var $child = $('<a class="tec-edit-field"><span class="tec-edit-link">' + edit + '</span><span class="tec-save-link">' + done + '</span></a>');
            $(th).append($child);
        });
    };

    Plugin.prototype.addButtonRows = function($tbody) {
        var selectAll = this.options.strings.selectAllButton;
        var $selectAllTr = $('<tr><td>&nbsp;</td><td><button class="tec-select-all" data-column="1">' + selectAll + '</button></td><td><button class="tec-select-all" data-column="2">' + selectAll + '</button></td><td>&nbsp;</td></tr>');
        $tbody.append($selectAllTr);
    };

    Plugin.prototype.addSaveRow = function() {
        var submit = this.options.strings.submitButton;
        var $saveTr = $('<tfoot><tr><td>&nbsp;</td><td><button class="tec-save-data">' + submit + '</button></td><td>&nbsp;</td><td>&nbsp;</td></tr></tfoot>');
        this.$element.append($saveTr);
    };

    Plugin.prototype.addEventHandlers = function() {
        this.$element.on('click', 'td.tec-data-cell, td.tec-data-cell > *', this.selectCell);
        this.$element.on('click', 'button.tec-select-all', this.selectColumn.bind(this));
        this.$element.on('click', '.tec-edit-field', this.toggleEditing.bind(this));
        this.$element.on('click', 'button.tec-save-data', this.save.bind(this));
    };

    Plugin.prototype.belongsToAGroup = function() {
        return (typeof this.group !== 'undefined');
    };

    Plugin.prototype.setupGrouping = function() {
        if (this.belongsToAGroup()) {
            GROUPED_TABLES[this.group] = GROUPED_TABLES[this.group] || [];
            GROUPED_TABLES[this.group].push(this);
            if (GROUPED_TABLES[this.group].length > 1) {
                GROUPED_TABLES[this.group][(GROUPED_TABLES[this.group].length - 2)].removeSaveButton();
            }
        }
    };

    Plugin.prototype.removeSaveButton = function() {
        this.$element.children('tfoot').remove();
    };

    $.fn.tableEditCompare = function(options) {
        return this.each(function() {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
            }
        });
    };
})(jQuery);
